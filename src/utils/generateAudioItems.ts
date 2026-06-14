import { IAction, IAudioItem } from "@fullstackcraftllc/codevideo-types"
import { sha256Hash } from "./sha256Hash.js";
import { uploadFileToS3 } from "./uploadFileToS3.js";
import { getAudioArrayBufferElevenLabs } from "../elevenlabs/getAudioArrayBufferElevenLabs.js";
import { getAudioArrayBufferKokoro } from "../tts/getAudioArrayBufferKokoro.js";

/**
 * Synthesize one author-speak text to an MP3 ArrayBuffer using the configured
 * provider. Default is elevenlabs (unchanged production behavior). Set
 * CODEVIDEO_TTS_PROVIDER=kokoro (with TTS_SERVICE_URL pointing at the
 * self-hosted codevideo-tts service) to drop the ElevenLabs dependency.
 */
const synthesize = async (textToSpeak: string): Promise<ArrayBuffer> => {
    const provider = process.env.CODEVIDEO_TTS_PROVIDER || "elevenlabs";
    if (provider === "kokoro") {
        const serviceUrl = process.env.TTS_SERVICE_URL;
        if (!serviceUrl) {
            throw new Error("CODEVIDEO_TTS_PROVIDER=kokoro requires TTS_SERVICE_URL to be set.");
        }
        return getAudioArrayBufferKokoro(textToSpeak, serviceUrl, process.env.KOKORO_VOICE);
    }
    return getAudioArrayBufferElevenLabs(textToSpeak, process.env.ELEVEN_LABS_API_KEY, process.env.ELEVEN_LABS_VOICE_ID);
}

export const generateAudioItems = async (actions: Array<IAction>): Promise<IAudioItem[]> => {
    const audioManifest = Array<{ text: string, mp3Url: string }>();

    // for each speak action, convert the text to audio and upload it to S3
    for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        const textToSpeak = action.value;
        const textHash = sha256Hash(textToSpeak);
        if (action.name.startsWith('author-speak')) {
            console.log(`Converting text at step index ${i} to audio... (hash is ${textHash})`);
            const arrayBuffer = await synthesize(textToSpeak);
            const buffer = Buffer.from(arrayBuffer);
            // upload the buffer to S3 (the cost being removed is the TTS API, not S3)
            const mp3Url = await uploadFileToS3(buffer, `${textHash}.mp3`);
            // add the text and mp3Url to the audioManifest
            audioManifest.push({ text: textToSpeak, mp3Url });
        }
    }

    // return the audio manifest
    return audioManifest;
}