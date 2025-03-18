import express, { Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import path from "path";
import fs from "fs";
import * as Sentry from "@sentry/node";
import cors from "cors";
import swaggerDocument from "../swagger.json" with { type: "json" };
import { IAction, ICodeVideoUserMetadata } from "@fullstackcraftllc/codevideo-types";
import { generateManifestFile } from "./utils/generateManifestFile.js";
import { clerkClient, clerkMiddleware, getAuth, requireAuth } from "@clerk/express";
import { userIsPayAsYouGo } from "./utils/userIsPayAsYouGo.js";
import 'dotenv/config'

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

const port = process.env.PORT || 7000;

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
    await generateManifestFile(dirname, actions, userId);

    // return success - user will be notified when video is ready
    res.status(200).json({ message: "Video generation enqueued successfully" });
  }
)

app.get(
  "/get-manifest-v3",
  async (
    req: Request<{}, {}, { actions: Array<IAction> }>,
    res: Response
  ) => {
    // returns the manifest.json file for the given uuid
    const uuid = req.query.uuid;
    console.log('return manifest for uuid', uuid)
    try {
      // first try to find file in the new folder
      let file = path.join(dirname, "..", "tmp", "v3", "new", `${uuid}.json`);
      if (!fs.existsSync(file)) {
        // if not found, try to find in the success folder
        file = path.join(dirname, "..", "tmp", "v3", "success", `${uuid}.json`);
        if (!fs.existsSync(file)) {
          // return not found if not found in either folder
          return res.status(404).json({ error: "Manifest not found" });
        }
      }

      res.sendFile(file);
    }
    catch (error) {
      console.error("Error getting manifest:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
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

CodeVideo API v${version}
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
