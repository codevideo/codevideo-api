import fs from "fs";
import path from "path";

export interface CleanupFailure {
    path: string;
    error: unknown;
}

export interface CleanupResult {
    deleted: number;
    bytes: number;
    failures: CleanupFailure[];
}

const sizeOf = async (entryPath: string): Promise<number> => {
    const stats = await fs.promises.lstat(entryPath);
    if (!stats.isDirectory()) return stats.size;
    let total = 0;
    for (const child of await fs.promises.readdir(entryPath)) {
        total += await sizeOf(path.join(entryPath, child));
    }
    return total;
};

const isMissing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === "ENOENT";

export const cleanupOldTmpFiles = async (dir: string, maxAgeMs: number, now: number = Date.now()): Promise<CleanupResult> => {
    // Removes every entry of `dir` last modified more than `maxAgeMs` ago. The
    // render worker leaves each job's webm/mp4 here after uploading to S3, and a
    // crashed deterministic render leaves a deterministic-* directory, so files
    // and directories both go. Renders take minutes, so a day-long cutoff never
    // touches a job that is still writing. A missing folder, or an entry that
    // vanishes mid-sweep, is not an error; any other failure is reported and the
    // sweep moves on so one bad entry can't stop the disk from being reclaimed.
    const result: CleanupResult = { deleted: 0, bytes: 0, failures: [] };
    let entries: string[];
    try {
        entries = await fs.promises.readdir(dir);
    } catch (error) {
        if (isMissing(error)) return result;
        throw error;
    }
    for (const name of entries) {
        const entryPath = path.join(dir, name);
        try {
            const stats = await fs.promises.lstat(entryPath);
            if (now - stats.mtimeMs <= maxAgeMs) continue;
            const bytes = await sizeOf(entryPath);
            await fs.promises.rm(entryPath, { recursive: true, force: true });
            result.deleted++;
            result.bytes += bytes;
        } catch (error) {
            if (!isMissing(error)) result.failures.push({ path: entryPath, error });
        }
    }
    return result;
};
