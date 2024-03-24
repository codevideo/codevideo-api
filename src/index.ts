import express, { Request, Response } from "express";
import { generateVideoFromActions } from "@fullstackcraftllc/codevideo-backend-engine";
import { IAction } from "@fullstackcraftllc/codevideo-types";
import swaggerUi from "swagger-ui-express";
import { enqueueVideoJob } from "./utils/enqueueVideoJob.js";
import swaggerDocument from "../swagger.json" assert { type: "json" };
import { uploadFileToSpaces } from "./utils/uploadFileToSpaces.js";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

// Initialize Express app
const app = express();
const port = process.env.PORT || 7000;

// Middleware for parsing JSON bodies
app.use(express.json());

// Serve Swagger UI
app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Define the interface for the request body
interface RequestBody {
  actions: IAction[];
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
      const actions = req.body.actions;
      const { guidv4, jobsInQueue } = await enqueueVideoJob(actions);
      res
        .status(200)
        .json({
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
      const actions = req.body.actions;
      const videoBuffer = await generateVideoFromActions(actions);
      const videoUrl = await uploadFileToSpaces(videoBuffer, `${uuidv4()}.mp4`);
      // return json response with url
      res.status(200).json({ url: videoUrl });
    } catch (error) {
      console.error("Error creating video:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
