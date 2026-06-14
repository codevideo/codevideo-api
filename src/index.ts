import express, { Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import path from "path";
import fs from "fs";
import * as Sentry from "@sentry/node";
import cors from "cors";
import swaggerDocument from "../swagger.json" with { type: "json" };
import { ICodeVideoUserMetadata } from "@fullstackcraftllc/codevideo-types";
import { generateManifestFile } from "./utils/generateManifestFile.js";
import { clerkClient, clerkMiddleware, getAuth, requireAuth } from "@clerk/express";
import { userIsPayAsYouGo } from "./utils/userIsPayAsYouGo.js";
import 'dotenv/config'
import { LanguageToolResponse } from "./languagetooltypes/languagetooltypes.js";

// Define the CORS options
const corsOptions = {
  origin: [
    "http://localhost:8000",
    "http://localhost:8001",
    "http://localhost:8002",
    "http://localhost:8888",
    "http://localhost:7001",
    "http://gatsby-static-server:7001",
    "https://api.codevideo.io",
    "https://staging.studio.codevideo.io",
    "https://studio.codevideo.io"
  ],
  methods: ["GET", "POST"],
};

// Initialize Express app
const app = express();

const port = process.env.PORT;

// The request handler must be the first middleware on the app
// app.use(Sentry.Handlers.requestHandler());

// // TracingHandler creates a trace for every incoming request
// app.use(Sentry.Handlers.tracingHandler());

// Enable CORS middleware for all requests
app.use(cors(corsOptions));

// Middleware for parsing JSON bodies
app.use(express.json());

// Serve Swagger UI
app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Get the directory name of the current module file
const dirname = path.dirname(new URL(import.meta.url).pathname);

// TODO: reactivate once the whole dependency mess with docker is fixed
// can use as long as codevideo doesn't get too popular - function runs concurrently well (up to 10 jobs tested)
// app.post(
//   "/create-video-immediately",
//   async (
//     req: Request<{}, {}, IGenerateVideoFromActionsOptions>,
//     res: Response
//   ) => {
//     try {
//       validateBodyParams(req, res);

//       // check if the server is at maximum generation capacity
//       const sumOfProcesses = await getSumOfProcesses(["ffmpeg", "chrome", "python", "Python"]);
//       if (sumOfProcesses > 30) {
//         return res.status(503).json({
//           error: "The server is currently at maximum CodeVideo generation power. Please wait a bit and try again later.",
//         });
//       }
//       const videoOptions = req.body;
//       const { videoBuffer } = await generateVideoFromActions(videoOptions);
//       const videoUrl = await uploadFileToSpaces(videoBuffer, `${uuidv4()}.mp4`);
//       return res.status(200).json({ url: videoUrl });
//     } catch (error) {
//       console.error("Error creating video:", error);
//       return res.status(500).json({ error: "Internal Server Error" });
//     }
//   }
// );

app.post(
  "/spellcheck",
  requireAuth(), // spell check requires authentication
  async (
    req,
    res
  ) => {
    const { userId } = getAuth(req);

    // If user isn't authenticated, return a 401 error
    if (userId === null) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // get locale and text from body
    const { locale, text } = req.body;
    
    // forward the request on to languagetool container running at localhost:8010
    try {
      const response = await fetch('http://localhost:8010/v2/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `language=${locale}&text=${text}`
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = (await response.json()) as LanguageToolResponse;
      const matches = data.matches

      return res.status(200).json({
        matches
      });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
)

app.post(
  "/create-video-v3",
  requireAuth(), // current video generation endpoint exposed on the studio
  async (
    req,
    res
  ) => {
    const { userId } = getAuth(req);

    // If user isn't authenticated, return a 401 error
    if (userId === null) {
      return res.status(401).json({ error: 'User not authenticated' })
    }
    const user = await clerkClient.users.getUser(userId)
    const metadata: ICodeVideoUserMetadata = user.publicMetadata as any || {}

    // if they don't have at least 10 tokens, return an error
    if (metadata.tokens < 10) {
      return res.status(400).json({ error: "You need at least 10 tokens to generate a video." });
    }

    // pay as you go customer (no plan name) have a limit of 250 actions
    if (userIsPayAsYouGo(metadata) && req.body.actions.length > 250) {
      return res.status(400).json({ error: "Only a maximum of 250 actions is allowed for pay-as-you-go customers. Please sign up for a premium subscription at https://studio.codevideo.io/ or see how to setup your own CodeVideo engine backend at https://github.com/codevideo/codevideo-api" });
    }

    const actions = req.body.actions;

    // TODO: for video-v4 - we could expose the entire options object to the user (all that are available to CodeVideoIDE component)
    // this created manifest is picked up by the go based CLI tool running in serve mode.
    await generateManifestFile(dirname, actions, userId);

    // return success - user will be notified when video is ready
    res.status(200).json({ message: "Video generation enqueued successfully" });
  }
)

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

CodeVideo ${process.env.ENVIRONMENT} API v${version}
Create software videos with the click of a button!
Copyright © ${year} Full Stack Craft
We're not a startup.
We're a software engineering company that Gets Stuff Done™. 🚀
  </pre>
  `);
});

// The error handler must be registered before any other error middleware and after all controllers
// app.use(Sentry.Handlers.errorHandler());
Sentry.setupExpressErrorHandler(app);

// clerk middleware
app.use(clerkMiddleware())

// Start the Express server
app.listen(port, () => {
  console.log(`CodeVideo API is running on port ${port}`);
});
