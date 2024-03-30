import os from "os";
import express, { Request, Response } from "express";
import {
  generateVideoFromActions,
  IGenerateVideoFromActionsOptions,
} from "@fullstackcraftllc/codevideo-backend-engine";
import swaggerUi from "swagger-ui-express";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import open from "open";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import cors from "cors";
import { enqueueVideoJob } from "./utils/enqueueVideoJob.js";
import swaggerDocument from "../swagger.json" assert { type: "json" };
import { uploadFileToSpaces } from "./utils/uploadFileToSpaces.js";
import cron from "node-cron";
import { runVideoJob } from "./utils/runVideoJob.js";
import { getSumOfProcesses } from "./utils/getSumOfProcesses.js";

// initialize jobs queue
const jobsQueue: Array<{
  guidv4: string;
  videoOptions: IGenerateVideoFromActionsOptions;
}> = [];

// Define the CORS options
const corsOptions = {
  origin: ["http://localhost:8888", "https://api.codevideo.io"],
  methods: ["GET", "POST"],
};

// Initialize Express app
const app = express();

const port = process.env.PORT || 7000;

Sentry.init({
  dsn: "https://06811c81e57eae0621f15301cd253319@o4505623207149568.ingest.us.sentry.io/4506982569279488",
  integrations: [
    // enable HTTP calls tracing
    new Sentry.Integrations.Http({ tracing: true }),
    // enable Express.js middleware tracing
    new Sentry.Integrations.Express({ app }),
    nodeProfilingIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 1.0,
});

// The request handler must be the first middleware on the app
app.use(Sentry.Handlers.requestHandler());

// TracingHandler creates a trace for every incoming request
app.use(Sentry.Handlers.tracingHandler());

// Enable CORS middleware for all requests
app.use(cors(corsOptions));

// Middleware for parsing JSON bodies
app.use(express.json());

// Serve Swagger UI
app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Get the directory name of the current module file
const dirname = path.dirname(new URL(import.meta.url).pathname);

// read in codeVideoAsciiArt.txt as a string
const codeVideoAsciiArt = fs.readFileSync(
  path.join(dirname, "..", "codeVideoAsciiArt.txt"),
  "utf-8"
);
const year = new Date().getFullYear();

// version from package.json
const { version } = JSON.parse(
  fs.readFileSync(path.join(dirname, "..", "package.json"), "utf-8")
);

// root endpoint just printing out some ascii art
app.get("/", (req: Request, res: Response) => {
  res.send(`
  <pre>
${codeVideoAsciiArt}

CodeVideo API v${version}
Create software videos with the click of a button!
Copyright © ${year} Full Stack Craft
We're not a startup.
We're a software engineering company that Gets Stuff Done™. 🚀
  </pre>
  `);
});

// Endpoint for enqueuing video generation jobs
app.post(
  "/enqueue-video-job",
  async (
    req: Request<{}, {}, IGenerateVideoFromActionsOptions>,
    res: Response
  ) => {
    try {
      validateBodyParams(req, res);
      const videoOptions = req.body;
      const guidv4 = await enqueueVideoJob(videoOptions);
      // add the job to the queue
      jobsQueue.push({ guidv4, videoOptions });
      res.status(200).json({
        message: "Video generation enqueued successfully",
        guidv4,
        placeInLine: jobsQueue.length,
      });
    } catch (error) {
      console.error("Error enqueuing action:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// can use as long as codevideo doesn't get too popular - function runs concurrently well (up to 10 jobs tested)
app.post(
  "/create-video-immediately",
  async (
    req: Request<{}, {}, IGenerateVideoFromActionsOptions>,
    res: Response
  ) => {
    try {
      validateBodyParams(req, res);
      
      // check if the server is at maximum generation capacity
      const sumOfProcesses = await getSumOfProcesses(["ffmpeg", "chrome", "python", "Python"]);
      if (sumOfProcesses > 30) {
        return res.status(503).json({
          error: "The server is currently at maximum CodeVideo generation power. Please wait a bit and try again later.",
        });
      }
      const videoOptions = req.body;
      // again, just to note, this function runs currently "safely"
      const videoBuffer = await generateVideoFromActions(videoOptions);
      const videoUrl = await uploadFileToSpaces(videoBuffer, `${uuidv4()}.mp4`);
      // return json response with url
      res.status(200).json({ url: videoUrl });
    } catch (error) {
      console.error("Error creating video:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

const validateBodyParams = (
  req: Request<{}, {}, IGenerateVideoFromActionsOptions>,
  res: Response
) => {
  const { actions, language, textToSpeechOption } = req.body;

  if (!actions) {
    return res.status(400).json({ error: "actions are required" });
  }

  if (!language) {
    return res.status(400).json({ error: "language is required" });
  }

  if (!textToSpeechOption) {
    return res.status(400).json({ error: "textToSpeechOption is required" });
  }

  // if actions are more than 100, return that they need to sign for a premium liscense at https://codevideo.io/codevideo-cloud/
  if (actions.length > 100) {
    return res.status(400).json({
      error:
        "You have more than 100 actions. Please sign up for a premium subscription at https://codevideo.io/codevideo-cloud/ or see how to setup your own CodeVideo engine backend at https://github.com/codevideo/codevideo-api",
    });
  }

  if (
    (textToSpeechOption === "openai" || textToSpeechOption === "elevenlabs") &&
    (!req.body.ttsApiKey || !req.body.ttsVoiceId)
  ) {
    return res.status(400).json({
      error:
        "If using 'openai' or 'elevenlabs' as the textToSpeechOption, you must provide both the 'ttsApiKey' and 'ttsVoiceId' parameters.",
    });
  }

  if (os.platform() === "linux" && textToSpeechOption === "sayjs") {
    return res.status(400).json({
      error: "sayjs is not supported for file export on linux",
    });
  }
};

// The error handler must be registered before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// if in dev mode, open to swagger page in chrome
if (process.env.NODE_ENV === "development") {
  open("http://localhost:7000/swagger");
}

// start cron to check for jobs in queue that runs every 1 second
cron.schedule("* * * * * *", async () => {
  if (jobsQueue.length > 0) {
    const videoJob = jobsQueue.shift();
    if (!videoJob) {
      console.log("No video job found in queue");
      return;
    }
    console.log("Running video job with GUID ", videoJob.guidv4);
    await runVideoJob(videoJob);
  }
});
