import { IAction, IAudioItem } from "@fullstackcraftllc/codevideo-types"
import { sha256Hash } from "./sha256Hash.js";
import { uploadFileToS3 } from "./uploadFileToS3.js";
import { getAudioArrayBufferElevenLabs } from "../elevenlabs/getAudioArrayBufferElevenLabs.js";
import { getAudioArrayBufferKokoro } from "../tts/getAudioArrayBufferKokoro.js";
import { isDevMode } from "./isDevMode.js";
import { ICreateVideoOptions, TtsProvider } from "./validateCreateVideoOptions.js";

/**
 * Resolve the TTS provider: an explicit request override (options.ttsProvider)
 * wins; otherwise kokoro in dev mode, else the CODEVIDEO_TTS_PROVIDER env
 * (default elevenlabs in production).
 */
const resolveProvider = (requested?: TtsProvider): TtsProvider => {
    if (requested) return requested;
    if (isDevMode()) return "kokoro";
    return (process.env.CODEVIDEO_TTS_PROVIDER as TtsProvider) || "elevenlabs";
};

/**
 * Synthesize one author-speak text to an MP3 ArrayBuffer using the resolved
 * provider. options.voiceId overrides the provider's default voice (a Kokoro
 * voice name, or an ElevenLabs voice id).
 */
const synthesize = async (textToSpeak: string, options: ICreateVideoOptions): Promise<ArrayBuffer> => {
    const provider = resolveProvider(options.ttsProvider);
    if (provider === "kokoro") {
        const serviceUrl = process.env.TTS_SERVICE_URL;
        if (!serviceUrl) {
            throw new Error("kokoro TTS requires TTS_SERVICE_URL to be set.");
        }
        return getAudioArrayBufferKokoro(textToSpeak, serviceUrl, options.voiceId ?? process.env.KOKORO_VOICE);
    }
    return getAudioArrayBufferElevenLabs(textToSpeak, process.env.ELEVEN_LABS_API_KEY, options.voiceId ?? process.env.ELEVEN_LABS_VOICE_ID);
}

/**
 * Build an audio item per author-speak action. In production the mp3 is uploaded
 * to S3 and the manifest holds the S3 url; in dev mode there's no S3, so the mp3
 * is embedded inline as a base64 data URI (the same shape the CLI's kokoro path
 * uses). voiceId / ttsProvider come from the request options.
 */
export const generateAudioItems = async (actions: Array<IAction>, options: ICreateVideoOptions = {}): Promise<IAudioItem[]> => {
    const audioManifest = Array<{ text: string, mp3Url: string }>();
    const dev = isDevMode();

    // for each speak action, synthesize audio and either upload it to S3 (prod)
    // or inline it as a data URI (dev)
    for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        const textToSpeak = action.value;
        const textHash = sha256Hash(textToSpeak);
        if (action.name.startsWith('author-speak')) {
            console.log(`Converting text at step index ${i} to audio... (hash is ${textHash})`);
            const arrayBuffer = await synthesize(textToSpeak, options);
            const buffer = Buffer.from(arrayBuffer);
            const mp3Url = dev
                ? `data:audio/mpeg;base64,${buffer.toString("base64")}`
                : await uploadFileToS3(buffer, `${textHash}.mp3`);
            audioManifest.push({ text: textToSpeak, mp3Url });
        }
    }

    // return the audio manifest
    return audioManifest;
}
