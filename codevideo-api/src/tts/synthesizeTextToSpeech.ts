import { getAudioArrayBufferKokoro } from "./getAudioArrayBufferKokoro.js";
import { getAudioArrayBufferElevenLabs } from "../elevenlabs/getAudioArrayBufferElevenLabs.js";
import {
  TextToSpeechError,
  ValidatedTextToSpeechRequest,
} from "./validateTextToSpeechRequest.js";
export async function synthesizeTextToSpeech(
  request: ValidatedTextToSpeechRequest,
): Promise<Buffer> {
  try {
    if (request.provider === "kokoro") {
      if (!process.env.TTS_SERVICE_URL)
        throw new TextToSpeechError(
          503,
          "Kokoro speech generation is not configured.",
        );
      return Buffer.from(
        await getAudioArrayBufferKokoro(
          request.text,
          process.env.TTS_SERVICE_URL,
          request.voiceId,
          request.speed,
        ),
      );
    }
    return Buffer.from(
      await getAudioArrayBufferElevenLabs(
        request.text,
        request.elevenLabsApiKey,
        request.voiceId,
      ),
    );
  } catch (error) {
    if (error instanceof TextToSpeechError) throw error;
    const status =
      error && typeof error === "object" && "status" in error
        ? error.status
        : undefined;
    if (request.provider === "elevenlabs" && (status === 401 || status === 403))
      throw new TextToSpeechError(400, "ElevenLabs rejected your key");
    // Provider failures can contain credentials or text. Never forward or log the upstream exception.
    throw new TextToSpeechError(
      502,
      "Speech generation failed. Please try again.",
    );
  }
}
