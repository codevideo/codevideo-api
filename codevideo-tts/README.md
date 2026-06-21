# codevideo-tts

Self-hosted, vendor-free text-to-speech for CodeVideo. Pure Node ([kokoro-js](https://www.npmjs.com/package/kokoro-js), q8 ONNX — no Python, no Docker required to run), exposing an **OpenAI-compatible** speech endpoint. Drops the ElevenLabs single-vendor dependency in the render pipeline.

## Run

```bash
npm install
npm start                 # listens on :3000, downloads the ~300MB model on first boot
# or: npm run smoke       # synthesize once without the server (writes /tmp/codevideo-tts-smoke.{wav,mp3})
```

ffmpeg is required for MP3 output (apt/brew install ffmpeg); without it the
service degrades to WAV rather than failing.

## API

```
GET  /health
POST /v1/audio/speech
     body: { "input": "text to speak", "voice"?: "af_heart", "response_format"?: "mp3"|"wav", "speed"?: 1 }
     -> audio bytes (audio/mpeg or audio/wav). Cached on disk by sha256(model|voice|speed|format|text).
```

Example:

```bash
curl -s -X POST localhost:3000/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"input":"Hello from CodeVideo.","response_format":"mp3"}' --output hello.mp3
```

## Config (env)

| var | default | purpose |
|---|---|---|
| `PORT` | `3000` | listen port |
| `TTS_API_KEY` | (none) | if set, require `Authorization: Bearer <key>` |
| `KOKORO_MODEL_ID` | `onnx-community/Kokoro-82M-v1.0-ONNX` | HF model |
| `KOKORO_DTYPE` | `q8` | model quantization (`q8`/`fp32`) |
| `KOKORO_DEVICE` | `cpu` | `cpu` (onnxruntime-node) or `wasm` |
| `KOKORO_VOICE` | `af_heart` | default voice |
| `TTS_CACHE_DIR` | `./audio-cache` | on-disk audio cache |
| `HF_HOME` | (default HF cache) | model cache dir — mount a volume in Docker to persist |

## Deploy alongside codevideo-api

Build the image (`docker build -t codevideo-tts .`) and add it as a service in
`codevideo-api/docker-compose.yml` with a named volume on `HF_HOME` so the model
persists. Point the API's audio generation at it via `TTS_SERVICE_URL`. The API
keeps uploading the returned audio to S3 (the cost being removed is the
ElevenLabs API, not S3); ElevenLabs stays as an optional BYOK provider.

## `alt-kokoro-web/`

The previous approach — a docker-compose wrapping the Python `kokoro-web`
service. Kept as a reference/alternative; the pure-Node service above is the
supported path.
