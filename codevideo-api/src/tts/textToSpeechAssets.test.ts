import { jest } from "@jest/globals";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
const upload = jest.fn<(...args: any[]) => Promise<string>>();
jest.unstable_mockModule("../utils/uploadFileToS3.js", () => ({
  uploadFileToS3: upload,
}));
const { storeTextToSpeechAudio, DEV_AUDIO_DIRECTORY } =
  await import("./textToSpeechAssets.js");
const environment = process.env.ENVIRONMENT;
afterEach(() => {
  if (environment === undefined) delete process.env.ENVIRONMENT;
  else process.env.ENVIRONMENT = environment;
  upload.mockReset();
});
it("writes each dev take to its own local MP3", async () => {
  process.env.ENVIRONMENT = "development";
  const one = await storeTextToSpeechAudio(
    Buffer.from("mp3"),
    "http://localhost:7000",
  );
  const two = await storeTextToSpeechAudio(
    Buffer.from("mp3"),
    "http://localhost:7000",
  );
  try {
    expect(one.assetId).not.toBe(two.assetId);
    expect(one.mp3Url).toBe(
      `http://localhost:7000/dev-audio/${one.assetId}.mp3`,
    );
    expect(
      await readFile(
        path.join(DEV_AUDIO_DIRECTORY, one.assetId + ".mp3"),
        "utf8",
      ),
    ).toBe("mp3");
    expect(upload).not.toHaveBeenCalled();
  } finally {
    await Promise.all(
      [one, two].map((t) =>
        unlink(path.join(DEV_AUDIO_DIRECTORY, t.assetId + ".mp3")),
      ),
    );
  }
});
it("uploads production MP3s under the approved immutable prefix", async () => {
  process.env.ENVIRONMENT = "production";
  upload.mockResolvedValue("https://audio");
  const take = await storeTextToSpeechAudio(Buffer.from("mp3"), "https://api");
  expect(upload).toHaveBeenCalledWith(
    Buffer.from("mp3"),
    `texttospeech/${take.assetId}.mp3`,
    {
      contentType: "audio/mpeg",
      cacheControl: "public, max-age=31536000, immutable",
    },
  );
  expect(take.mp3Url).toBe("https://audio");
});
