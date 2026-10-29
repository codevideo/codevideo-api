import path from "path";
import cron from "node-cron";
import * as Sentry from "@sentry/node";
import { cleanupOldTmpFiles } from "./cleanupOldTmpFiles.js";

export const scheduleTmpVideoCleanup = (dirname: string) => {
    // FUL-265: the render worker never deletes its webm/mp4 output, so sweep
    // tmp/v3/video hourly (and once at startup). Production and staging mount the
    // same tmp/v3, so only the instance with TMP_VIDEO_CLEANUP=true sweeps.
    if (process.env.TMP_VIDEO_CLEANUP !== "true") return;

    const videoFolder = path.join(dirname, "..", "tmp", "v3", "video");
    const maxAgeHours = Number(process.env.TMP_VIDEO_MAX_AGE_HOURS) || 24;

    const sweep = async () => {
        try {
            const { deleted, bytes, failures } = await cleanupOldTmpFiles(videoFolder, maxAgeHours * 60 * 60 * 1000);
            if (deleted > 0) {
                console.log(`tmp video cleanup: removed ${deleted} entries (${(bytes / 1e6).toFixed(1)} MB) older than ${maxAgeHours}h`);
            }
            for (const failure of failures) {
                console.error(`tmp video cleanup: could not remove ${failure.path}:`, failure.error);
                Sentry.captureException(failure.error);
            }
        } catch (error) {
            console.error("tmp video cleanup failed:", error);
            Sentry.captureException(error);
        }
    };

    console.log(`tmp video cleanup: sweeping ${videoFolder} hourly for entries older than ${maxAgeHours}h`);
    void sweep();
    cron.schedule("17 * * * *", sweep);
};
