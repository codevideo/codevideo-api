const { launch, getStream, wss } = require("puppeteer-stream");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

// define sleep helper function
const sleep = ms => new Promise(res => setTimeout(res, ms));

async function recordVideoV3() {
    // if no uuid is provided, exit
    if (!process.argv[2]) {
        console.error("Please provide a UUID as the first argument.");
        process.exit(1);
    }

    // get  uuid from first argument
    const uuid = process.argv[2];

    console.log("Starting recording for UUID: ", uuid);

    const outputWebm = path.join(__dirname, `../tmp/v3/video/${uuid}.webm`);
    const outputMp4 = path.join(__dirname, `../tmp/v3/video/${uuid}.mp4`);
    const file = fs.createWriteStream(outputWebm);

    const browser = await launch({
        dumpio: true,
        // macOS:
        // executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        // linux (docker):
        executablePath: "/usr/bin/chromium-browser",
        headless: "new", // supports audio!
        // headless: false, // for debugging
        defaultViewport: { width: 1920, height: 1080 },
        args: [
            '--window-size=1920,1080',
            '--start-fullscreen',
            '--ozone-override-screen-size=1920,1080', // for linux
            '--no-sandbox', // to run as root on docker
            '--autoplay-policy=no-user-gesture-required',
            '--disable-web-security',
            // '--enable-logging=stderr',  // Enable detailed logging
            // '--v=1',                    // Increase verbosity level
        ],
        ignoreDefaultArgs: ['--mute-audio']
    });

    const page = await browser.newPage();








    // In your page's JavaScript:
    await page.evaluate(() => {
        // Test direct fetch to the audio URL
        async function testFetch(url) {
            try {
                const startTime = performance.now();
                const response = await fetch(url, { method: 'HEAD' });
                const endTime = performance.now();

                console.log(`Fetch test for ${url}:`);
                console.log(`  Status: ${response.status} ${response.statusText}`);
                console.log(`  Time: ${Math.round(endTime - startTime)}ms`);
                console.log(`  Headers:`, Object.fromEntries([...response.headers]));

                return response.ok;
            } catch (error) {
                console.log(`Fetch error for ${url}:`, error.message);
                return false;
            }
        }

        // Capture audio element creation and add advanced debugging
        const originalCreateElement = document.createElement;
        document.createElement = function (tagName) {
            const element = originalCreateElement.call(document, tagName);
            if (tagName.toLowerCase() === 'audio') {
                // Intercept src setting
                const originalSetAttribute = element.setAttribute;
                element.setAttribute = function (name, value) {
                    if (name === 'src') {
                        console.log(`Setting audio src to: ${value}`);
                        // Test connectivity to the audio URL
                        testFetch(value).then(success => {
                            console.log(`Connectivity test for audio URL: ${success ? 'SUCCESS' : 'FAILED'}`);
                        });
                    }
                    return originalSetAttribute.call(this, name, value);
                };

                // Detailed error reporting
                element.addEventListener('error', (event) => {
                    const error = element.error || {};
                    console.log(`AUDIO ERROR DETAILS:`);
                    console.log(`- Source: ${element.src}`);
                    console.log(`- Error Code: ${error.code || 'N/A'}`);
                    console.log(`- Error Message: ${error.message || 'None'}`);
                    console.log(`- Network State: ${element.networkState}`);
                    console.log(`- Ready State: ${element.readyState}`);

                    // Try alternative fetch to check connectivity
                    testFetch(element.src);
                });
            }
            return element;
        };
    });

    // Also add DNS resolution testing before navigating
    await page.evaluate(() => {
        // Check DNS resolution for the audio domain
        const audioHost = 'coffee-app.sfo2.cdn.digitaloceanspaces.com';
        console.log(`Testing DNS resolution for ${audioHost}...`);

        const img = new Image();
        const testUrl = `https://${audioHost}/test.pixel?t=${Date.now()}`;
        img.onload = () => console.log(`DNS resolution success for ${audioHost}`);
        img.onerror = () => console.log(`DNS resolution test failed for ${audioHost}`);
        img.src = testUrl;
    });







    // Log domcontentloaded
    page.once('domcontentloaded', () => {
        console.log('DOM content loaded');
    });

    // Log load
    page.once('load', () => {
        console.log('Page fully loaded');
    });

    // Log all browser console messages.
    page.on('console', msg => {
        console.log('BROWSER LOG:', msg.text());
    });

    // Create a promise that resolves when the final progress update is received.
    let resolveFinalProgress;
    const finalProgressPromise = new Promise(resolve => {
        resolveFinalProgress = resolve;
    });

    // Expose __onActionProgress so that progress stats from the client are logged in Node.
    // When a final progress update is received, we resolve the promise.
    await page.exposeFunction('__onActionProgress', (progress) => {
        console.log("Progress update:", progress);
        // Check if this progress update indicates completion.
        if (progress.progress === "100.0" || progress.currentAction >= progress.totalActions) {
            resolveFinalProgress();
        }
    });
    console.log("added __onActionProgress");

    // Navigate to the puppeteer page.
    await page.setViewport({ width: 0, height: 0 });

    const url = `http://gatsby-static-server:7001/v3?uuid=${uuid}`;
    console.log(`Navigating to ${url}`);
    await page.goto(url);
    console.log("Page navigated");

    // click body to trigger interaction
    await page.click("body");
    console.log("Clicked body");

    // Inject CSS to remove margins/padding so the video fills the viewport
    await page.addStyleTag({ content: `body { margin: 0; padding: 0; }` });
    console.log("Added style tag");


    const videoConstraints = {
        mandatory: {
            minWidth: 1920,
            minHeight: 1080,
            maxWidth: 1920,
            maxHeight: 1080,
        },
    };

    // Start the stream and pipe it to a file.
    const stream = await getStream(page, {
        audio: true,
        video: true,
        mimeType: "video/webm", // WebM is well-supported for high-quality web video
        audioBitsPerSecond: 384000, // 384 kbps for high-quality stereo audio
        videoBitsPerSecond: 20000000, // 20 Mbps (20,000 kbps) for high-quality 1080p video
        frameSize: 16, // approx 60 FPS
        videoConstraints
    });
    stream.pipe(file);
    console.log("Recording started");

    // Wait a moment before triggering start.
    await sleep(1000);

    // Send signal to react component to start recording
    console.log("Triggering recording start...");
    await page.evaluate(() => {
        window.__startRecording();
    })

    // Wait until the client sends a final progress update.
    await finalProgressPromise;

    // Wait a moment before stopping the recording.
    await sleep(1000);

    // Once complete, tear down the recording.
    console.log("Final progress received. Stopping recording...");
    await stream.destroy();
    file.close();
    console.log("Recording finished");

    await browser.close();
    (await wss).close();

    // Once we're sure the webm file is done, convert it to mp4.
    console.log("Starting conversion from WebM to MP4...");
    try {
        await convertToMp4(outputWebm, outputMp4);
        console.log("Conversion complete:", outputMp4);
    } catch (err) {
        console.error("Error converting file:", err);
    }
}

function convertToMp4(input, output) {
    return new Promise((resolve, reject) => {
        // -y: overwrite output file if it exists
        // -i: input file
        // -c:v: video codec
        // -preset: encoding speed
        // -crf: quality level (lower is better)
        // -r: frame rate (60 FPS)
        // -c:a: audio codec
        // -b:a: audio bitrate (384 kbps)
        const ffmpegCommand = `ffmpeg -y -i "${input}" -c:v libx264 -preset fast -crf 18 -r 60 -c:a aac -b:a 384k "${output}"`;
        exec(ffmpegCommand, (error, stdout, stderr) => {
            if (error) {
                return reject(error);
            }
            resolve();
        });
    });
}

recordVideoV3().catch(err => {
    console.error("Error during recording:", err);
});
