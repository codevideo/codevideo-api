import fs from "fs";
import os from "os";
import path from "path";
import { cleanupOldTmpFiles } from "./cleanupOldTmpFiles.js";

const DAY = 24 * 60 * 60 * 1000;

const backdate = (entryPath: string, ageMs: number) => {
  const time = new Date(Date.now() - ageMs);
  fs.utimesSync(entryPath, time, time);
};

describe("cleanupOldTmpFiles", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmp-video-cleanup-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("removes old videos and crashed render folders, and keeps fresh files", async () => {
    fs.writeFileSync(path.join(dir, "old.mp4"), "12345");
    fs.writeFileSync(path.join(dir, "fresh.webm"), "abc");
    const crashed = path.join(dir, "deterministic-123");
    fs.mkdirSync(crashed);
    fs.writeFileSync(path.join(crashed, "frame.jpg"), "1234567");
    // backdate after writing: adding frame.jpg refreshed the folder's mtime
    backdate(path.join(dir, "old.mp4"), 2 * DAY);
    backdate(crashed, 2 * DAY);

    const result = await cleanupOldTmpFiles(dir, DAY);

    expect(fs.readdirSync(dir)).toEqual(["fresh.webm"]);
    expect(result).toEqual({ deleted: 2, bytes: 12, failures: [] });
  });

  it("keeps a file that is just under the cutoff", async () => {
    fs.writeFileSync(path.join(dir, "rendering.webm"), "abc");
    backdate(path.join(dir, "rendering.webm"), DAY - 60_000);

    const result = await cleanupOldTmpFiles(dir, DAY);

    expect(result.deleted).toBe(0);
    expect(fs.readdirSync(dir)).toEqual(["rendering.webm"]);
  });

  it("treats a missing folder as nothing to do", async () => {
    await expect(cleanupOldTmpFiles(path.join(dir, "missing"), DAY)).resolves.toEqual({
      deleted: 0,
      bytes: 0,
      failures: [],
    });
  });
});
