import { KokoroTTS, TextSplitterStream } from "kokoro-js";
import { spawn } from "node:child_process";

const MODEL_ID = process.env.KOKORO_MODEL_ID || "onnx-community/Kokoro-82M-v1.0-ONNX";
const DTYPE = (process.env.KOKORO_DTYPE || "q8") as any;
const DEVICE = (process.env.KOKORO_DEVICE || "cpu") as any;

export const DEFAULT_VOICE = process.env.KOKORO_VOICE || "af_heart";
export const MODEL_LABEL = `${MODEL_ID}#${DTYPE}`;

let ttsPromise: Promise<any> | null = null;

/** Lazy singleton — the model loads once (≈20s cold incl. download, ≈300ms warm). */
export const getTTS = (): Promise<any> => {
  if (!ttsPromise) {
    ttsPromise = KokoroTTS.from_pretrained(MODEL_ID, { dtype: DTYPE, device: DEVICE });
  }
  return ttsPromise;
};

/** True once the model is resolved (for /health). */
export let ready = false;
export const warm = async (): Promise<void> => {
  await getTTS();
  ready = true;
};

/**
 * Synthesize text to mono PCM samples. Uses the streaming splitter so long
 * narration (beyond Kokoro's ~510-token window) is chunked by sentence and
 * concatenated rather than truncated.
 */
const synthSamples = async (
  text: string,
  voice: string,
  speed: number
): Promise<{ samples: Float32Array; sampleRate: number }> => {
  const tts = await getTTS();
  const splitter = new TextSplitterStream();
  const stream = tts.stream(splitter, { voice, speed });
  splitter.push(text);
  splitter.close();

  const chunks: Float32Array[] = [];
  let sampleRate = 24000;
  for await (const { audio } of stream) {
    if (!audio?.audio) throw new Error("kokoro-js returned an unexpected RawAudio shape (no .audio)");
    chunks.push(audio.audio as Float32Array);
    sampleRate = audio.sampling_rate ?? sampleRate;
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const samples = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    samples.set(c, offset);
    offset += c.length;
  }
  return { samples, sampleRate };
};

/** Encode mono float samples as a 16-bit PCM WAV buffer. */
export const encodeWav = (samples: Float32Array, sampleRate: number): Buffer => {
  const dataBytes = samples.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // PCM fmt chunk size
  buf.writeUInt16LE(1, 20); // audio format = PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(dataBytes, 40);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7fff, off);
    off += 2;
  }
  return buf;
};

/** WAV → MP3 via ffmpeg (stdin→stdout). Requires ffmpeg on PATH. */
export const wavToMp3 = (wav: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", ["-loglevel", "error", "-i", "pipe:0", "-f", "mp3", "-b:a", "160k", "pipe:1"]);
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    ff.stdout.on("data", (d) => out.push(d));
    ff.stderr.on("data", (d) => err.push(d));
    ff.on("error", (e) => reject(new Error(`ffmpeg not available: ${e.message}`)));
    ff.on("close", (code) =>
      code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`ffmpeg exited ${code}: ${Buffer.concat(err)}`))
    );
    ff.stdin.write(wav);
    ff.stdin.end();
  });

export interface SynthResult {
  buffer: Buffer;
  contentType: string;
  format: "wav" | "mp3";
}

/** Synthesize and return audio in the requested format (mp3 default, wav fallback if ffmpeg missing). */
export const synthesize = async (
  text: string,
  opts: { voice?: string; speed?: number; format?: "wav" | "mp3" } = {}
): Promise<SynthResult> => {
  const voice = opts.voice || DEFAULT_VOICE;
  const speed = opts.speed ?? 1;
  const { samples, sampleRate } = await synthSamples(text, voice, speed);
  const wav = encodeWav(samples, sampleRate);
  if ((opts.format ?? "mp3") === "wav") {
    return { buffer: wav, contentType: "audio/wav", format: "wav" };
  }
  try {
    const mp3 = await wavToMp3(wav);
    return { buffer: mp3, contentType: "audio/mpeg", format: "mp3" };
  } catch {
    // ffmpeg missing — degrade to wav rather than fail the render pipeline
    return { buffer: wav, contentType: "audio/wav", format: "wav" };
  }
};
