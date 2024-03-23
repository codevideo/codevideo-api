import express, { Request, Response } from 'express';
import { generateVideoFromActions } from '@fullstackcraftllc/codevideo-backend-engine';
import { IAction } from '@fullstackcraftllc/codevideo-types';
import { enqueueVideoJob } from './utils/enqueueVideoJob.js';


// Initialize Express app
const app = express();
const port = process.env.PORT || 7000;

// Middleware for parsing JSON bodies
app.use(express.json());

// Define the interface for the request body
interface RequestBody {
    actions: IAction[];
}

// POST endpoint for enqueuing actions
app.post('/enqueue-video-job', async (req: Request<{}, {}, RequestBody>, res: Response) => {
    try {
        const actions = req.body.actions
        const {guidv4, jobsInQueue} = await enqueueVideoJob(actions);
        res.status(200).json({ message: 'Video generation enqueued successfully', guidv4, jobsInQueue });
    } catch (error) {
        console.error('Error enqueuing action:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// for testing purposes
app.post('/create-video-immediately', async (req: Request<{}, {}, RequestBody>, res: Response) => {
    try {
        const actions = req.body.actions
        const videoBuffer = await generateVideoFromActions(actions);
        res.end(videoBuffer);
    } catch (error) {
        console.error('Error enqueuing action:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Start the Express server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
