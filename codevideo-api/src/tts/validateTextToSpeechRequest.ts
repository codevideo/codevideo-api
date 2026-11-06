import { isKokoroVoice } from "./kokoroVoices.js";
export class TextToSpeechError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export interface ValidatedTextToSpeechRequest {
  text: string;
  provider: "kokoro" | "elevenlabs";
  voiceId: string;
  speed: number;
  elevenLabsApiKey?: string;
}
export function validateTextToSpeechRequest(
  body: unknown,
  defaultVoice = process.env.KOKORO_VOICE,
): ValidatedTextToSpeechRequest {
  const fail = (message: string): never => {
    throw new TextToSpeechError(400, message);
  };
  if (!body || typeof body !== "object" || Array.isArray(body))
    return fail("Expected a JSON object.");
  const b = body as Record<string, unknown>;
  if (typeof b.text !== "string" || !b.text.trim() || b.text.length > 1000)
    return fail("text must contain 1–1000 characters.");
  const provider = b.provider === undefined ? "kokoro" : b.provider;
  if (provider !== "kokoro" && provider !== "elevenlabs")
    return fail("provider must be kokoro or elevenlabs.");
  const speed = b.speed === undefined ? 1 : b.speed;
  if (
    typeof speed !== "number" ||
    !Number.isFinite(speed) ||
    speed < 0.5 ||
    speed > 2
  )
    return fail("speed must be between 0.5 and 2.");
  if (provider === "kokoro") {
    const voiceId =
      b.voiceId === undefined ? defaultVoice || "af_heart" : b.voiceId;
    if (!isKokoroVoice(voiceId))
      return fail("Choose a supported English Kokoro voice.");
    return { text: b.text, provider, voiceId, speed };
  }
  if (typeof b.voiceId !== "string" || !/^[A-Za-z0-9]{10,40}$/.test(b.voiceId))
    return fail("ElevenLabs requires a voiceId with 10–40 letters or numbers.");
  if (
    typeof b.elevenLabsApiKey !== "string" ||
    !b.elevenLabsApiKey.trim() ||
    b.elevenLabsApiKey.length > 1000 ||
    /[\r\n]/.test(b.elevenLabsApiKey)
  )
    return fail("ElevenLabs requires your API key.");
  // The current ElevenLabs client has no speed option; never advertise a speed we did not synthesize.
  if (speed !== 1) return fail("ElevenLabs speed must be 1.");
  return {
    text: b.text,
    provider,
    voiceId: b.voiceId,
    speed: 1,
    elevenLabsApiKey: b.elevenLabsApiKey,
  };
}
