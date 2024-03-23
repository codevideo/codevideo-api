import { IAction } from "@fullstackcraftllc/codevideo-types";
import {
  incrementJobsInQueue,
  getJobsInQueue,
  addJob,
} from "../supabase.js";
import { v4 as uuidv4 } from "uuid";
import { startVideoJob } from "./startVideoJob.js";

export const enqueueVideoJob = async (
  actions: Array<IAction>
): Promise<{ guidv4: string; jobsInQueue: number }> => {
  // Generate a unique token (guidv4) for this job
  const guidv4 = uuidv4();

  // start the job for these actions
  // note this is async but we don't await it
  startVideoJob(guidv4, actions);

  // Increment jobs in queue counter
  await incrementJobsInQueue();

  // add that the job to the jobs table - status is queued
  await addJob(guidv4, "queued");

  const jobsInQueue = await getJobsInQueue();

  return { guidv4, jobsInQueue };
};
