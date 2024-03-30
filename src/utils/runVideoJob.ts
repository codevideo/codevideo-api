import {
  generateVideoFromActions,
  IGenerateVideoFromActionsOptions,
} from "@fullstackcraftllc/codevideo-backend-engine";
import {
  updateJobInSupabase,
} from "../supabase/supabase.js";
import { uploadFileToSpaces } from "./uploadFileToSpaces.js";

export const runVideoJob = async (
  videoJob: {
    guidv4: string;
    videoOptions: IGenerateVideoFromActionsOptions;
  }
) => {
  const { guidv4, videoOptions } = videoJob;
  try {
    const { actions, language, textToSpeechOption } = videoOptions;
    const video = await generateVideoFromActions({
      actions,
      language,
      textToSpeechOption,
    });

    // Upload video to digital ocean bucket with the guidv4 as the filename
    await uploadFileToSpaces(video, `${guidv4}.mp4`);

    // Update the job status to done
    await updateJobInSupabase(guidv4, "done");
  } catch (error) {

    console.error("Error generating video:", error);
    await updateJobInSupabase(guidv4, "error");
  }
};
