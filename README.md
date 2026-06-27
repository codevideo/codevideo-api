# CodeVideo server monorepo

The CodeVideo backend stack in one repo: the API, the generation backend (genie),
and self-hosted text-to-speech (tts). Everything deploys from a single checkout —
no sibling folders required.

```
.
├── codevideo-api/     # Express API — video creation, S3, auth, TTS orchestration (:7000)
├── codevideo-genie/   # LLM → CodeVideo actions backend, HTTP + WebSocket (:3001, proxied at /genie)
├── codevideo-tts/     # self-hosted Kokoro TTS, OpenAI-compatible (:3000, internal)
├── nginx/             # reverse proxy + TLS termination
├── certbot/           # Let's Encrypt (runtime certs are gitignored)
├── tmp/v3/            # render-queue bind mount shared with the host worker
├── docker-compose.yml # orchestrates every service
├── .env / .env.staging# central env (gitignored) — see .env.example
└── .github/workflows/ # CI (per-app build/test) + autodeploy (SSH to host)
```

## Run the whole stack

```bash
cp .env.example .env          # then fill in secrets (S3, Clerk, LLM key, ...)
docker compose up -d --build
```

`docker compose up` builds and starts api + genie + tts + nginx + languagetool.
The compose file uses local build contexts (`./codevideo-api`, `./codevideo-genie`,
`./codevideo-tts`), so a clone is fully self-contained.

## Central environment

One `.env` at the repo root feeds every service via `env_file: .env`. Shared
secrets and provider selection live there; per-service values that would collide
(ports, service URLs) are pinned in `docker-compose.yml` `environment:` — notably
`PORT=3000` for tts, which overrides the API's `PORT` from the shared file. See
[.env.example](.env.example) for the full list. The staging API reads `.env.staging`.

## Local development

`docker compose up` runs the full stack. To iterate on one service, run it
directly (Node 20+; the central `.env` is one level up).

**Kokoro TTS** — no auth, the quickest way to try voices:

```bash
cd codevideo-tts && npm install && npm start   # :3000, downloads ~300MB model on first boot
curl -s localhost:3000/health
curl -s -X POST localhost:3000/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"input":"Hello from CodeVideo.","voice":"af_heart"}' --output hello.mp3
```

`voice` is the same string you pass as the API's `options.voiceId` (e.g. `af_heart`,
`am_michael`, `bf_emma`).

**API** — set `CODEVIDEO_TTS_PROVIDER=kokoro` and `TTS_SERVICE_URL=http://localhost:3000`
in the central `.env` (alongside your Supabase/Clerk/S3 keys), then:

```bash
cd codevideo-api && npm install && npm run build
node --env-file=../.env dist/index.js          # :7000
```

`POST /create-video-v3` needs an API key (`x-api-key: cvk_…`, tied to a Clerk user
with ≥10 tokens). It synthesizes audio, uploads to S3, and writes a manifest to
`tmp/v3/new/` for the host worker to render:

```bash
curl -s -X POST localhost:7000/create-video-v3 \
  -H 'Content-Type: application/json' -H 'x-api-key: cvk_YOUR_KEY' \
  -d '{"project":[{"name":"author-speak-before","value":"Hello world."}],
       "options":{"voiceId":"am_michael","theme":"dark","withCaptions":true}}'
```

## CI / CD

- **CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) — on PRs into main
  and pushes to other branches: per-app `npm ci` + type-check (+ test/build where
  defined).
- **Deploy** ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) — on
  push to `main` (or manual dispatch): SSH to the host and
  `git pull --ff-only && docker compose up -d --build`. Requires the `DEPLOY_*`
  secrets listed in that file. See [DEPLOYMENT.md](DEPLOYMENT.md) for server state
  and pre-reqs.
