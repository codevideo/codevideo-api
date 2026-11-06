import fetch from "isomorphic-fetch";

/**
 * Fetch MP3 audio from the self-hosted codevideo-tts service (Kokoro, pure
 * Node). Drop-in replacement for getAudioArrayBufferElevenLabs: same
 * ArrayBuffer return, so the S3-upload path is unchanged.
 *
 * The service exposes an OpenAI-compatible POST /v1/audio/speech.
 */
export const getAudioArrayBufferKokoro = async (
  textToSpeak: string,
  serviceUrl: string,
  voice?: string,
  speed = 1,
): Promise<ArrayBuffer> => {
  const url = `${serviceUrl.replace(/\/$/, "")}/v1/audio/speech`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.TTS_API_KEY) {
    headers.Authorization = `Bearer ${process.env.TTS_API_KEY}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      input: textToSpeak,
      voice: voice || process.env.KOKORO_VOICE,
      response_format: "mp3",
      speed,
    }),
  });

  if (!response.ok) {
    throw new Error(`codevideo-tts returned HTTP ${response.status}`);
  }
  return await response.arrayBuffer();
};
