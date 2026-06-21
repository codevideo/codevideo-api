import express from "express";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { synthesize, warm, ready, MODEL_LABEL, DEFAULT_VOICE } from "./synth.js";

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.TTS_API_KEY || process.env.KW_SECRET_API_KEY || ""; // optional bearer
const CACHE_DIR = process.env.TTS_CACHE_DIR || path.resolve("audio-cache");

const app = express();
app.use(express.json({ limit: "1mb" }));

// optional bearer auth (matches the kokoro-web "Authorization: Bearer <key>" shape)
const authed = (req: express.Request): boolean => {
  if (!API_KEY) return true;
  return req.headers.authorization === `Bearer ${API_KEY}`;
};

app.get("/health", (_req, res) => {
  res.json({ status: "ok", model: MODEL_LABEL, defaultVoice: DEFAULT_VOICE, ready });
});

/**
 * OpenAI-compatible speech endpoint (same shape ide-react + kokoro-web already speak):
 *   POST /v1/audio/speech  { input, voice?, response_format?: "mp3"|"wav", speed? }
 * Returns audio bytes. Cached on disk by sha256(model|voice|speed|format|text).
 */
app.post("/v1/audio/speech", async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: "unauthorized" });

  const input: string = req.body?.input ?? req.body?.text;
  if (!input || typeof input !== "string") {
    return res.status(400).json({ error: "missing 'input' (non-empty string)" });
  }
  const voice: string = req.body?.voice || DEFAULT_VOICE;
  const speed: number = Number(req.body?.speed ?? 1);
  const format: "wav" | "mp3" = req.body?.response_format === "wav" ? "wav" : "mp3";

  const key = createHash("sha256").update(`${MODEL_LABEL}|${voice}|${speed}|${format}|${input}`).digest("hex");
  const cachePath = path.join(CACHE_DIR, `${key}.${format}`);

  try {
    if (existsSync(cachePath)) {
      const cached = await readFile(cachePath);
      res.setHeader("X-Cache", "HIT");
      res.type(format === "mp3" ? "audio/mpeg" : "audio/wav");
      return res.send(cached);
    }
    const { buffer, contentType, format: actual } = await synthesize(input, { voice, speed, format });
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(path.join(CACHE_DIR, `${key}.${actual}`), buffer);
    res.setHeader("X-Cache", "MISS");
    res.type(contentType);
    return res.send(buffer);
  } catch (e) {
    console.error("[codevideo-tts] synth error:", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "synthesis failed" });
  }
});

app.listen(PORT, () => {
  console.log(`[codevideo-tts] listening on :${PORT} (model ${MODEL_LABEL})`);
  // warm the model at boot so the first request isn't slow
  warm()
    .then(() => console.log("[codevideo-tts] model ready"))
    .catch((e) => console.error("[codevideo-tts] model warm failed:", e));
});
