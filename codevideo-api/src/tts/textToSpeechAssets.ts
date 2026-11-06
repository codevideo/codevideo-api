import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { uploadFileToS3 } from "../utils/uploadFileToS3.js";
import { isDevMode } from "../utils/isDevMode.js";
export const SPEECH_S3_ORIGIN =
  "https://fullstackcraft.s3.us-east-1.amazonaws.com";
export const SPEECH_S3_PREFIX = "/codevideo/texttospeech/";
export const DEV_AUDIO_DIRECTORY = fileURLToPath(
  new URL("../../tmp/audio/texttospeech/", import.meta.url),
);
export const SPEECH_FILENAME =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.mp3$/i;
export async function storeTextToSpeechAudio(
  buffer: Buffer,
  origin: string,
): Promise<{ mp3Url: string; assetId: string }> {
  const assetId = randomUUID();
  const filename = `${assetId}.mp3`;
  if (isDevMode()) {
    await mkdir(DEV_AUDIO_DIRECTORY, { recursive: true });
    await writeFile(path.join(DEV_AUDIO_DIRECTORY, filename), buffer, {
      flag: "wx",
    });
    return { assetId, mp3Url: `${origin}/dev-audio/${filename}` };
  }
  return {
    assetId,
    mp3Url: await uploadFileToS3(buffer, `texttospeech/${filename}`, {
      contentType: "audio/mpeg",
      cacheControl: "public, max-age=31536000, immutable",
    }),
  };
}
