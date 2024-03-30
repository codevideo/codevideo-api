import {
  addJobToSupabase,
} from "../supabase/supabase.js";
import { v4 as uuidv4 } from "uuid";
import { IGenerateVideoFromActionsOptions } from "@fullstackcraftllc/codevideo-backend-engine";

// enqueues a video job
export const enqueueVideoJob = async (
  videoOptions: IGenerateVideoFromActionsOptions
) => {
  // Generate a unique token (guidv4) for this job
  const guidv4 = uuidv4();

  // add that the job to the jobs table - status is queued
  await addJobToSupabase(guidv4, "queued");

  return guidv4
};
