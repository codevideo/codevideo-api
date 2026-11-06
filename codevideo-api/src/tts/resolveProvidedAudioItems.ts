import { IAudioItem } from "@fullstackcraftllc/codevideo-types";
import { TextToSpeechError } from "./validateTextToSpeechRequest.js";
import {
  SPEECH_FILENAME,
  SPEECH_S3_ORIGIN,
  SPEECH_S3_PREFIX,
} from "./textToSpeechAssets.js";
export interface AudioValidationContext {
  dev: boolean;
  origin: string;
}
export function devAudioFilename(url: URL): string | undefined {
  if (!url.pathname.startsWith("/dev-audio/")) return;
  const filename = url.pathname.slice("/dev-audio/".length);
  return SPEECH_FILENAME.test(filename) ? filename : undefined;
}
export function resolveProvidedAudioItems(
  input: unknown,
  context: AudioValidationContext,
): IAudioItem[] {
  if (input === undefined) return [];
  const fail = (message: string): never => {
    throw new TextToSpeechError(400, message);
  };
  if (!Array.isArray(input) || input.length > 500)
    return fail("audioItems must be an array of at most 500 takes.");
  const texts = new Map<string, string>();
  return input.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.text !== "string" ||
      !item.text.trim() ||
      item.text.length > 1000 ||
      typeof item.mp3Url !== "string" ||
      item.mp3Url.length > 2048
    )
      return fail(
        "Each audio item needs text (1–1000 characters) and an approved MP3 URL.",
      );
    let url: URL;
    try {
      url = new URL(item.mp3Url);
    } catch {
      return fail("Invalid audio item URL.");
    }
    const s3 =
      url.origin === SPEECH_S3_ORIGIN &&
      url.pathname.startsWith(SPEECH_S3_PREFIX) &&
      SPEECH_FILENAME.test(url.pathname.slice(SPEECH_S3_PREFIX.length));
    const dev =
      context.dev && url.origin === context.origin && !!devAudioFilename(url);
    if (url.username || url.password || url.search || url.hash || (!s3 && !dev))
      return fail("Audio items must reference CodeVideo speech takes.");
    if (
      item.durationMs !== undefined &&
      (typeof item.durationMs !== "number" ||
        !Number.isFinite(item.durationMs) ||
        item.durationMs <= 0 ||
        item.durationMs > 3600000)
    )
      return fail(
        "durationMs must be a positive number no larger than one hour.",
      );
    if (texts.has(item.text) && texts.get(item.text) !== url.href)
      return fail("Provide only one audio take per exact text.");
    texts.set(item.text, url.href);
    return {
      text: item.text,
      mp3Url: url.href,
      ...(item.durationMs !== undefined ? { durationMs: item.durationMs } : {}),
    };
  });
}
