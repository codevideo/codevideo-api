import express, { Request, Response, text } from "express";
import {
  generateVideoFromActions,
  TextToSpeechOptions,
} from "@fullstackcraftllc/codevideo-backend-engine";
import { IAction } from "@fullstackcraftllc/codevideo-types";
import swaggerUi from "swagger-ui-express";
import { enqueueVideoJob } from "./utils/enqueueVideoJob.js";
import swaggerDocument from "../swagger.json" assert { type: "json" };
import { uploadFileToSpaces } from "./utils/uploadFileToSpaces.js";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import open from "open";
import * as Sentry from "@sentry/node"
import { nodeProfilingIntegration } from "@sentry/profiling-node";

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

// Middleware for parsing JSON bodies
app.use(express.json());

// Serve Swagger UI
app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Define the interface for the request body
interface RequestBody {
  actions: IAction[];
  textToSpeechOption: TextToSpeechOptions;
  ttsApiKey?: string;
  ttsVoiceId?: string;
}

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
  async (req: Request<{}, {}, RequestBody>, res: Response) => {
    try {
      const { actions, textToSpeechOption } = req.body;
      if (
        textToSpeechOption === "openai" ||
        textToSpeechOption === "elevenlabs" ||
        textToSpeechOption === "sayjs"
      ) {
        return res
          .status(400)
          .json({
            error: "Currently only festival is supported as a TTS engine",
          });
      }
      const { guidv4, jobsInQueue } = await enqueueVideoJob(
        actions,
        textToSpeechOption
      );
      res.status(200).json({
        message: "Video generation enqueued successfully",
        guidv4,
        jobsInQueue,
      });
    } catch (error) {
      console.error("Error enqueuing action:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// for testing purposes
app.post(
  "/create-video-immediately",
  async (req: Request<{}, {}, RequestBody>, res: Response) => {
    try {
      const { actions, textToSpeechOption } = req.body;

      if (
        textToSpeechOption === "openai" ||
        textToSpeechOption === "elevenlabs" ||
        textToSpeechOption === "sayjs"
      ) {
        return res
          .status(400)
          .json({
            error: "Currently only festival is supported as a TTS engine",
          });
      }

      const videoBuffer = await generateVideoFromActions(
        actions,
        textToSpeechOption
      );
      const videoUrl = await uploadFileToSpaces(videoBuffer, `${uuidv4()}.mp4`);
      // return json response with url
      res.status(200).json({ url: videoUrl });
    } catch (error) {
      console.error("Error creating video:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

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
