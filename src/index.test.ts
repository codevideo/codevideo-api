import { describe, expect } from "@jest/globals";
import { enqueueVideoJob } from "./utils/enqueueVideoJob.js";
import { wait } from "./utils/wait.js";
import { getJobByIdFromSupabase } from "./supabase/supabase.js";
import { IGenerateVideoFromActionsOptions } from "@fullstackcraftllc/codevideo-backend-engine";

describe("api", () => {
  it("queues two calls properly after one another", async () => {
    // simple two step action - one speak and one type-editor action
    const videoOptions: IGenerateVideoFromActionsOptions = {
      actions: [
        {
          name: "speak-before",
          value: "I'm going to type some code now.",
        },
        {
          name: "type-editor",
          value: "console.log('Hello, world!');",
        },
      ],
      language: "javascript",
      textToSpeechOption: "festival",
    };

    // use promise.all to enqueue two videos
    const [result1guid, result2guid] = await Promise.all([
      enqueueVideoJob(videoOptions),
      enqueueVideoJob(videoOptions),
    ]);
    const job1 = await getJobByIdFromSupabase(result1guid);
    const job2 = await getJobByIdFromSupabase(result2guid);

    // we expect the status to be correct for both jobs
    expect(job1.status).toBe("started");
    expect(job2.status).toBe("queued");

    // after some amount of time, the first job should be done and the second one should be started
    await wait(10000);
    const job1Again = await getJobByIdFromSupabase(result1guid);
    const job2Again = await getJobByIdFromSupabase(result2guid);
    expect(job1Again.status).toBe("done");
    expect(job2Again.status).toBe("started");

    // after even more time, both jobs should have status 'done'
    await wait(10000);
    const job1AgainAgain = await getJobByIdFromSupabase(result1guid);
    const job2AgainAgain = await getJobByIdFromSupabase(result2guid);
    expect(job1AgainAgain.status).toBe("done");
    expect(job2AgainAgain.status).toBe("done");
  });
});
