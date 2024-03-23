import { describe, expect } from "@jest/globals";
import { IAction } from "@fullstackcraftllc/codevideo-types";
import { enqueueVideoJob } from '../../src/utils/enqueueVideoJob';
import { getJob, getJobsInQueue } from "../../src/supabase";
import { wait } from "../utils/wait";

describe("api", () => {
    it("queues two calls properly after one another", async () => {
        // simple two step action - one speak and one type-editor action
        const actions: Array<IAction> = [
            {
                name: "speak-before",
                value: "I'm going to type some code now.",
            },
            {
                name: "type-editor",
                value: "console.log('Hello, world!');",
            },
        ];

        // use promise.all to enqueue two videos 
        const [result1, result2] = await Promise.all([
            enqueueVideoJob(actions),
            enqueueVideoJob(actions),
        ]);
        const job1 = await getJob(result1.guidv4);
        const job2 = await getJob(result2.guidv4);
        
        // we expect the job counter to be correct
        expect(result1.jobsInQueue).toBe(1);
        expect(result2.jobsInQueue).toBe(2);

        // and the status to be correct for both jobs
        expect(job1.status).toBe('started');
        expect(job2.status).toBe('queued');

        // after some amount of time, the job count should be back to 1 and the first job should be done and the second one should be started
        await wait(10000);
        const jobsInQueue = await getJobsInQueue();
        expect(jobsInQueue).toBe(1)
        const job1again = await getJob(result1.guidv4);
        const job2again = await getJob(result2.guidv4);
        expect(job1again.status).toBe('done');
        expect(job2again.status).toBe('started');

        // after even more time, the job count should be 0 and both jobs should have status 'done'
        await wait(10000);
        const jobsInQueueAgain = await getJobsInQueue();
        expect(jobsInQueueAgain).toBe(0)
        const job1againagain = await getJob(result1.guidv4);
        const job2againagain = await getJob(result2.guidv4);
        expect(job1againagain.status).toBe('done');
        expect(job2againagain.status).toBe('done');
    
    });
});