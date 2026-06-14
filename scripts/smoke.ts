/**
 * Smoke test: synthesize directly (no HTTP) and assert we get real audio.
 * Run with `npm run smoke`. Does not require the server to be running, but does
 * download the model on first run.
 */
import { writeFile } from "node:fs/promises";
import { synthesize } from "../src/synth.js";

const text = "Let's scaffold a small TypeScript service from an empty workspace.";

const t0 = Date.now();
const wav = await synthesize(text, { format: "wav" });
const t1 = Date.now();
const mp3 = await synthesize(text, { format: "mp3" });
const t2 = Date.now();

await writeFile("/tmp/codevideo-tts-smoke.wav", wav.buffer);
await writeFile("/tmp/codevideo-tts-smoke.mp3", mp3.buffer);

const ok =
  wav.format === "wav" &&
  wav.buffer.length > 1000 &&
  wav.buffer.subarray(0, 4).toString() === "RIFF";

console.log(
  JSON.stringify(
    {
      wavBytes: wav.buffer.length,
      wavLoadAndSynthMs: t1 - t0,
      mp3Bytes: mp3.buffer.length,
      mp3Format: mp3.format, // "mp3" if ffmpeg present, else "wav" fallback
      mp3SynthMs: t2 - t1,
      pass: ok,
    },
    null,
    2
  )
);
if (!ok) process.exit(1);
