import { jest } from "@jest/globals";
import {
  mkdir,
  readFile,
  writeFile,
  unlink,
  mkdtemp,
  rm,
  readdir,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
const kokoro = jest.fn<(...args: any[]) => Promise<ArrayBuffer>>();
const eleven = jest.fn<(...args: any[]) => Promise<ArrayBuffer>>();
const upload = jest.fn<(...args: any[]) => Promise<string>>();
jest.unstable_mockModule("../tts/getAudioArrayBufferKokoro.js", () => ({
  getAudioArrayBufferKokoro: kokoro,
}));
jest.unstable_mockModule(
  "../elevenlabs/getAudioArrayBufferElevenLabs.js",
  () => ({ getAudioArrayBufferElevenLabs: eleven }),
);
jest.unstable_mockModule("./uploadFileToS3.js", () => ({
  uploadFileToS3: upload,
}));
const { generateAudioItems } = await import("./generateAudioItems.js");
const { generateManifestFile } = await import("./generateManifestFile.js");
const { resolveProvidedAudioItems } =
  await import("../tts/resolveProvidedAudioItems.js");
const { DEV_AUDIO_DIRECTORY } = await import("../tts/textToSpeechAssets.js");
const environment = process.env.ENVIRONMENT;
const provider = process.env.CODEVIDEO_TTS_PROVIDER;
const tts = process.env.TTS_SERVICE_URL;
const filename = "aaaaaaaa-1234-1234-1234-123456789abc.mp3";
const mp3Url = `https://fullstackcraft.s3.us-east-1.amazonaws.com/codevideo/texttospeech/${filename}`;
afterEach(() => {
  for (const [key, value] of Object.entries({
    ENVIRONMENT: environment,
    CODEVIDEO_TTS_PROVIDER: provider,
    TTS_SERVICE_URL: tts,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  kokoro.mockReset();
  eleven.mockReset();
  upload.mockReset();
});
it("reuses exact matches for repeated speech, synthesizing only missing speech", async () => {
  process.env.ENVIRONMENT = "production";
  delete process.env.CODEVIDEO_TTS_PROVIDER;
  eleven.mockResolvedValue(new Uint8Array([1, 2]).buffer);
  upload.mockResolvedValue("https://fallback");
  const items = await generateAudioItems(
    [
      { name: "author-speak-before", value: "Reuse" },
      { name: "editor-type", value: "Reuse" },
      { name: "author-speak-after", value: "Reuse" },
      { name: "author-speak-before", value: "Reuse!" },
    ],
    {},
    [{ text: "Reuse", mp3Url, durationMs: 1200 }],
  );
  expect(items).toEqual([
    { text: "Reuse", mp3Url, durationMs: 1200 },
    { text: "Reuse", mp3Url, durationMs: 1200 },
    { text: "Reuse!", mp3Url: "https://fallback" },
  ]);
  expect(eleven).toHaveBeenCalledTimes(1);
  expect(eleven.mock.calls[0][0]).toBe("Reuse!");
  expect(kokoro).not.toHaveBeenCalled();
});
it("retains existing no-take production synthesis", async () => {
  process.env.ENVIRONMENT = "production";
  delete process.env.CODEVIDEO_TTS_PROVIDER;
  eleven.mockResolvedValue(new Uint8Array([1]).buffer);
  upload.mockResolvedValue("https://fallback");
  expect(
    await generateAudioItems([{ name: "author-speak-before", value: "Hi" }]),
  ).toEqual([{ text: "Hi", mp3Url: "https://fallback" }]);
  expect(eleven).toHaveBeenCalledTimes(1);
});
it("writes a dev render manifest with reused MP3 data and no synthesis", async () => {
  process.env.ENVIRONMENT = "development";
  await mkdir(DEV_AUDIO_DIRECTORY, { recursive: true });
  await writeFile(
    path.join(DEV_AUDIO_DIRECTORY, filename),
    Buffer.from("approved mp3"),
  );
  const root = await mkdtemp(path.join(os.tmpdir(), "cv-take-reuse-"));
  try {
    const provided = resolveProvidedAudioItems(
      [
        {
          text: "Reuse",
          mp3Url: `http://localhost:7000/dev-audio/${filename}`,
          durationMs: 2400,
        },
      ],
      { dev: true, origin: "http://localhost:7000" },
    );
    await generateManifestFile(
      path.join(root, "dist"),
      [{ name: "author-speak-before", value: "Reuse" }],
      "local-dev",
      {},
      provided,
    );
    const files = await readdir(path.join(root, "tmp/v3/new"));
    const manifest = JSON.parse(
      await readFile(path.join(root, "tmp/v3/new", files[0]), "utf8"),
    );
    expect(manifest.audioItems).toEqual([
      {
        text: "Reuse",
        mp3Url:
          "data:audio/mpeg;base64," +
          Buffer.from("approved mp3").toString("base64"),
        durationMs: 2400,
      },
    ]);
    expect(kokoro).not.toHaveBeenCalled();
    expect(eleven).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  } finally {
    await unlink(path.join(DEV_AUDIO_DIRECTORY, filename));
    await rm(root, { recursive: true, force: true });
  }
});
it("uses Kokoro and inline MP3s for missing lines in dev mode", async () => {
  process.env.ENVIRONMENT = "development";
  process.env.TTS_SERVICE_URL = "http://tts";
  kokoro.mockResolvedValue(new Uint8Array([1, 2]).buffer);
  const items = await generateAudioItems([
    { name: "author-speak-before", value: "New" },
  ]);
  expect(items[0].mp3Url).toBe("data:audio/mpeg;base64,AQI=");
  expect(kokoro).toHaveBeenCalledTimes(1);
  expect(upload).not.toHaveBeenCalled();
});
