package utils

import (
	"encoding/json"
	"os"
)

func AddErrorToManifest(manifestPath string, error string) {
	// Read the manifest file.
	manifestBytes, err := os.ReadFile(manifestPath)
	if err != nil {
		return
	}

	// Unmarshal the manifest JSON.
	var manifest map[string]interface{}
	if err := json.Unmarshal(manifestBytes, &manifest); err != nil {
		return
	}

	// Add the error key and value.
	manifest["error"] = error

	// Marshal the manifest back to JSON.
	updatedManifestBytes, err := json.Marshal(manifest)
	if err != nil {
		return
	}

	// Write the updated manifest back to the file.
	if err := os.WriteFile(manifestPath, updatedManifestBytes, 0644); err != nil {
		return
	}
}
