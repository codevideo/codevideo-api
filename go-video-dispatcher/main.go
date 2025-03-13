package main

import (
	"bufio"
	"context"
	"encoding/json"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/clerk/clerk-sdk-go/v2/user"
	"github.com/codevideo/go-video-dispatcher/cloud"
	"github.com/codevideo/go-video-dispatcher/mail"
	"github.com/codevideo/go-video-dispatcher/types"
	"github.com/codevideo/go-video-dispatcher/utils"
	"github.com/fsnotify/fsnotify"
	"github.com/joho/godotenv"
)

const (
	newFolder       = "tmp/v3/new"
	errorFolder     = "tmp/v3/error"
	successFolder   = "tmp/v3/success"
	videoFolder     = "tmp/v3/video"
	nodeScriptName  = "puppeteer-runner/recordVideoV3.js"
	decrementAmount = 10
)

var debounceMu sync.Mutex
var debounceMap = make(map[string]*time.Timer)

// create a hash map of urls available to boolean (if being used)
// sadly because of the tabCapture API, we can't record on the same

func main() {

	// Load environment variables from .env file.
	if err := godotenv.Load(); err != nil {
		log.Fatal("Error loading .env file")
	}

	// Ensure required directories exist.
	for _, dir := range []string{newFolder, errorFolder, successFolder, videoFolder} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			log.Fatalf("Error creating directory %s: %v", dir, err)
		}
	}

	// Set up a watcher on the newFolder.
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Fatal(err)
	}
	defer watcher.Close()

	if err := watcher.Add(newFolder); err != nil {
		log.Fatal(err)
	}

	// semaphore channel to limit concurrency to 10 jobs.
	semaphore := make(chan struct{}, 10)

	// Optionally, you could do an initial scan of the folder for any existing JSON files in the 'new' folder.
	// filepath.Walk(newFolder, func(path string, info os.FileInfo, err error) error {
	// 	if err != nil {
	// 		return nil
	// 	}
	// 	if !info.IsDir() && filepath.Ext(path) == ".json" {
	// 		semaphore <- struct{}{}
	// 		go func(p string) {
	// 			defer func() { <-semaphore }()
	// 			processJob(p)
	// 		}(path)
	// 	}
	// 	return nil
	// })

	log.Println("Watching for new manifest files in", newFolder)

	// Listen for filesystem events.
	for {
		select {
		case event, ok := <-watcher.Events:
			if !ok {
				return
			}
			// Process only create events for new JSON files.
			if event.Op&fsnotify.Create == fsnotify.Create {
				if filepath.Ext(event.Name) == ".json" {
					debounceMu.Lock()
					// If a timer exists for this file, stop it to reset the debounce period.
					if timer, exists := debounceMap[event.Name]; exists {
						timer.Stop()
					}
					// Set a new timer with a 500ms debounce interval.
					debounceMap[event.Name] = time.AfterFunc(500*time.Millisecond, func() {
						log.Printf("Detected new file: %s", event.Name)
						// Limit concurrent processing.
						semaphore <- struct{}{}
						go func(filePath string) {
							defer func() { <-semaphore }()
							// Optional delay to ensure the file is fully written.
							time.Sleep(2 * time.Second)
							processJob(filePath)
						}(event.Name)
						// Clean up the timer from the map.
						debounceMu.Lock()
						delete(debounceMap, event.Name)
						debounceMu.Unlock()
					})
					debounceMu.Unlock()
				}
			}
		case err, ok := <-watcher.Errors:
			if !ok {
				return
			}
			log.Println("Watcher error:", err)
		}
	}
}

// moveFile moves a file from src to dst.
func moveFile(src, dst string) error {
	// Ensure the destination directory exists.
	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
	}
	return os.Rename(src, dst)
}

func unmarshalManifest(manifestPath string) (*types.CodeVideoManifest, error) {
	manifestBytes, err := os.ReadFile(manifestPath)
	if err != nil {
		return nil, err
	}
	var metadata types.CodeVideoManifest
	if err := json.Unmarshal(manifestBytes, &metadata); err != nil {
		return nil, err
	}
	return &metadata, nil
}

// processJob reads the manifest file, calls the Puppeteer script, sends an email if successful,
// and moves the manifest to the error or success folder.
func processJob(manifestPath string) {
	base := filepath.Base(manifestPath)
	manifest, err := unmarshalManifest(manifestPath)
	if err != nil {
		log.Printf("Failed to unmarshal manifest file: %v", err)
		utils.AddErrorToManifest(manifestPath, err.Error())
		return
	}
	uuid := manifest.UUID
	clerkUserId := manifest.UserID

	ramUsage, err := utils.GetRAMUsage()
	if err != nil {
		log.Printf("Failed to get RAM usage: %v", err)
	}
	log.Printf("Processing job: %s (RAM usage is at %s)", uuid, ramUsage)

	// Call the Puppeteer script using node.
	cmd := exec.Command("node", nodeScriptName, uuid)
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		log.Printf("Error obtaining stdout pipe: %v", err)
		return
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		log.Printf("Error obtaining stderr pipe: %v", err)
		return
	}

	if err := cmd.Start(); err != nil {
		log.Printf("Job %s failed to start: %v", uuid, err)
		return
	}

	// Stream stdout concurrently.
	go func() {
		scanner := bufio.NewScanner(stdoutPipe)
		for scanner.Scan() {
			log.Printf("[Puppeteer stdout]: %s", scanner.Text())
		}
		if err := scanner.Err(); err != nil {
			log.Printf("Error reading stdout: %v", err)
		}
	}()

	// Stream stderr concurrently.
	go func() {
		scanner := bufio.NewScanner(stderrPipe)
		for scanner.Scan() {
			log.Printf("[Puppeteer stderr]: %s", scanner.Text())
		}
		if err := scanner.Err(); err != nil {
			log.Printf("Error reading stderr: %v", err)
		}
	}()

	// Wait for the command to finish.
	if err := cmd.Wait(); err != nil {
		log.Printf("Job %s failed: %v", uuid, err)
		// Optionally capture additional output if needed.
	}

	// If the Puppeteer script succeeded, read and upload the mp4 to DigitalOcean Spaces.
	mp4Path := filepath.Join(videoFolder, uuid+".mp4")
	mp4Bytes, err := os.ReadFile(mp4Path)
	if err != nil {
		log.Printf("Failed to read mp4 file for job %s: %v", uuid, err)
		utils.AddErrorToManifest(manifestPath, err.Error())
		return
	}

	mp4Url, err := cloud.UploadFileToSpaces(context.Background(), mp4Bytes, uuid+".mp4")
	if err != nil {
		log.Printf("Failed to upload file for job %s: %v", uuid, err)
		utils.AddErrorToManifest(manifestPath, err.Error())
		return
	}

	// use the clerk userID to get the email address of the user
	apiKey := os.Getenv("CLERK_SECRET_KEY")
	if apiKey == "" {
		log.Println("CLERK_SECRET_KEY not set")
	}
	config := &clerk.ClientConfig{}
	config.Key = &apiKey
	client := user.NewClient(config)
	clerkUser, err := client.Get(context.Background(), clerkUserId)
	if err != nil {
		log.Printf("Failed to get user: %v", err)
		utils.AddErrorToManifest(manifestPath, err.Error())
		return
	}
	userEmail := clerkUser.EmailAddresses[0].EmailAddress

	// Then send an email notification including the mp4 URL.
	if err := mail.SendEmail(userEmail, mp4Url); err != nil {
		log.Printf("Failed to send email for job %s: %v", uuid, err)

		// add an error key and value to the manifest file.
		utils.AddErrorToManifest(manifestPath, err.Error())
		log.Printf("Failed to add error to manifest file: %v", err)

		if err := moveFile(manifestPath, filepath.Join(errorFolder, base)); err != nil {
			log.Printf("Failed to move manifest to error folder: %v", err)
		}
		return
	}

	log.Printf("Email sent to %s for job %s", userEmail, uuid)

	currentTokens := 0

	if clerkUser.PublicMetadata != nil {
		var meta map[string]interface{}
		if err := json.Unmarshal(clerkUser.PublicMetadata, &meta); err == nil {
			switch v := meta["tokens"].(type) {
			case float64:
				currentTokens = int(v)
			case string:
				currentTokens, _ = strconv.Atoi(v)
			}
		}
	}

	newTokens := currentTokens - decrementAmount
	metadata, _ := json.Marshal(map[string]interface{}{"tokens": newTokens})
	params := user.UpdateMetadataParams{
		PublicMetadata: (*json.RawMessage)(&metadata),
	}

	if _, err := client.UpdateMetadata(context.Background(), clerkUserId, &params); err != nil {
		log.Printf("Failed to update user metadata: %v", err)
		utils.AddErrorToManifest(manifestPath, err.Error())
	} else {
		log.Printf("Successfully decremented user tokens from %d to %d", currentTokens, newTokens)
	}

	// Finally, move the manifest to the success folder.
	if err := moveFile(manifestPath, filepath.Join(successFolder, base)); err != nil {
		log.Printf("Failed to move manifest to success folder: %v", err)
	} else {
		log.Printf("Job %s processed successfully", uuid)
	}

	// cleanup: remove the mp4 and webm files, decrement 10 tokens from the user
	if err := os.Remove(mp4Path); err != nil {
		log.Printf("Failed to remove mp4 file for job %s: %v", uuid, err)
	}
	webmPath := filepath.Join(videoFolder, uuid+".webm")
	if err := os.Remove(webmPath); err != nil {
		log.Printf("Failed to remove webm file for job %s: %v", uuid, err)
	}
}
