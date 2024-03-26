import { IAction } from "@fullstackcraftllc/codevideo-types";
import { generateVideoFromActions, TextToSpeechOptions } from "@fullstackcraftllc/codevideo-backend-engine";
import { decrementJobsInQueue, updateJob } from "../supabase/supabase.js";
import { uploadFileToSpaces } from "./uploadFileToSpaces.js";

// global lock variable and queue lol
let isProcessing = false;
const jobsQueue: Array<{ guidv4: string; actions: Array<IAction> }> = [];

export const startVideoJob = async (
    guidv4: string,
    actions: Array<IAction>,
    textToSpeechOption: TextToSpeechOptions
  ) => {
    // If we're not processing a job, start processing this one
    if (!isProcessing) {
      try {
        const video = await generateVideoFromActions(actions, textToSpeechOption);
  
        // Upload video to digital ocean bucket with the guidv4 as the filename
        await uploadFileToSpaces(video, `${guidv4}.mp4`);
        
        // Decrement jobs in queue counter after processing
        await decrementJobsInQueue();
  
        // Update the job status to done
        await updateJob(guidv4, "done");
  
        // If there are more jobs in the queue, start processing the next one
        if (jobsQueue.length > 0) {
          const nextJob = jobsQueue.shift();
          if (nextJob) {
            startVideoJob(nextJob.guidv4, nextJob.actions, textToSpeechOption);
          }
        }
      } catch (error) {
        console.error("Error generating video:", error);
        await updateJob(guidv4, "error");
      }
    } else {
      jobsQueue.push({ guidv4, actions });
    }
  };
  