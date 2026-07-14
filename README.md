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
├── tmp/v3/            # render-queue bind mount shared with the codevideo-cli worker
├── docker-compose.yml # orchestrates every service
├── .env               # central env (gitignored) — see .env.example
├── .env.staging       # central env for staging (gitignored)
├── .env.development   # central env for development (gitignored)
└── .github/workflows/ # CI (per-app build/test) + autodeploy (SSH to host)
```

## Run the whole stack

```bash
cp .env.example .env          # then fill in secrets (S3, Clerk, LLM key, ...)
docker compose up -d --build
```

`docker compose up` builds and starts api + genie + tts + nginx + languagetool, and
pulls the render worker (`fullstackcraft/codevideo-cli`) from Docker Hub. The API
services build from local contexts (`./codevideo-api`, `./codevideo-genie`,
`./codevideo-tts`); the worker is a published image, not a local build.

## Render worker (codevideo-cli)

Video rendering runs in the `codevideo-cli` service — the Go CLI in serve mode,
pulled from Docker Hub (`fullstackcraft/codevideo-cli`, its own repo:
[codevideo/codevideo-cli](https://github.com/codevideo/codevideo-cli)). It shares
nothing with the API but the `tmp/v3/` render queue: the API writes a manifest to
`tmp/v3/new/`, the worker renders it, uploads the mp4 to S3, emails the user, and
moves the manifest to `success/`.

The image is **pinned by version** in [docker-compose.yml](docker-compose.yml) — bump
that tag when codevideo-cli cuts a release. `docker compose pull` (run automatically on
deploy) fetches it. If the image repo is private, `docker login` to Docker Hub first
(locally and on the server).

## Central environment

One `.env` at the repo root feeds every service via `env_file: .env`. Shared
secrets and provider selection live there; per-service values that would collide
(ports, service URLs) are pinned in `docker-compose.yml` `environment:` — notably
`PORT=3000` for tts, which overrides the API's `PORT` from the shared file. See
[.env.example](.env.example) for the full list. The staging API reads `.env.staging`.

## Local development

`docker compose up` runs the full stack. To iterate on one service, run it
directly (Node 20+; the central `.env` is one level up).

## CI / CD

- **CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) — on PRs into main
  and pushes to other branches: per-app `npm ci` + type-check (+ test/build where
  defined).
- **Deploy** ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) — on
  push to `main` (or manual dispatch): SSH to the host and
  `git pull --ff-only && docker compose up -d --build`. Requires the `DEPLOY_*`
  secrets listed in that file. See [DEPLOYMENT.md](DEPLOYMENT.md) for server state
  and pre-reqs.

## Examples

Each example is a complete request — replace `cvk_YOUR_KEY` and paste it into a
terminal. Every action needs a non-empty `value`; repeatable ones (clicks, enter)
use `"1"`. Voice ids come from Kokoro (e.g. `af_heart`, `am_michael`, `bf_emma`).

> **Dev mode vs. real backend:** with the local override (dev mode,
> `ENVIRONMENT=development`) none of these need a key — auth and S3 are off and TTS
> defaults to Kokoro, so `cvk_YOUR_KEY` is ignored and the audio is inlined into the
> manifest. Add `"ttsProvider": "elevenlabs"` to `options` to force ElevenLabs.
> Against staging/production you do need a real key: keys live in Clerk (the key
> embeds your user id, who needs ≥10 tokens), minted from the studio's API-keys page.

### 1. Minimal — no options (defaults)

```shell
curl -s -X POST localhost:7000/create-video-v3 \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: cvk_YOUR_KEY' \
  --data-binary @- <<'JSON'
{
  "project": [
    {"name": "author-speak-before", "value": "Let's write our first line of JavaScript."},
    {"name": "file-explorer-create-file", "value": "hello.js"},
    {"name": "editor-type", "value": "console.log('hello world');"},
    {"name": "author-wait", "value": "1000"},
    {"name": "author-speak-before", "value": "That's it — thanks for watching!"}
  ]
}
JSON
```

### 2. Pick a TTS voice — `voiceId`

```shell
curl -s -X POST localhost:7000/create-video-v3 \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: cvk_YOUR_KEY' \
  --data-binary @- <<'JSON'
{
  "project": [
    {"name": "author-speak-before", "value": "Here's a quick TypeScript type alias."},
    {"name": "file-explorer-create-file", "value": "types.ts"},
    {"name": "editor-type", "value": "type ID = string | number;"},
    {"name": "editor-enter", "value": "1"},
    {"name": "editor-type", "value": "const userId: ID = 42;"},
    {"name": "author-speak-before", "value": "Simple, and fully type-safe."}
  ],
  "options": { "voiceId": "am_michael" }
}
JSON
```

### 3. Vertical short — `orientation` + `resolution`

> Validated and stored now, but these change the actual video only once the render
> worker reads `videoOptions` (Tier 2). The other options below apply immediately.

```shell
curl -s -X POST localhost:7000/create-video-v3 \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: cvk_YOUR_KEY' \
  --data-binary @- <<'JSON'
{
  "project": [
    {"name": "author-speak-before", "value": "A vertical clip for shorts."},
    {"name": "file-explorer-create-file", "value": "app.py"},
    {"name": "editor-type", "value": "print('hello, shorts!')"},
    {"name": "author-wait", "value": "800"},
    {"name": "author-speak-before", "value": "Perfect for phones."}
  ],
  "options": { "orientation": "portrait", "resolution": "1080p" }
}
JSON
```

### 4. Layout & captions — `theme`, `fontSizePx`, `withCaptions`, `isTerminalVisible`

```shell
curl -s -X POST localhost:7000/create-video-v3 \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: cvk_YOUR_KEY' \
  --data-binary @- <<'JSON'
{
  "project": [
    {"name": "author-speak-before", "value": "Bigger font, captions on, terminal hidden."},
    {"name": "file-explorer-create-file", "value": "main.go"},
    {"name": "editor-type", "value": "package main"},
    {"name": "editor-enter", "value": "1"},
    {"name": "editor-type", "value": "func main() {}"},
    {"name": "author-speak-before", "value": "Easy to read on any screen."}
  ],
  "options": { "theme": "light", "fontSizePx": 32, "withCaptions": true, "isTerminalVisible": false }
}
JSON
```

### 5. Pacing & a terminal run — pause timings + `voiceId`

```shell
curl -s -X POST localhost:7000/create-video-v3 \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: cvk_YOUR_KEY' \
  --data-binary @- <<'JSON'
{
  "project": [
    {"name": "author-speak-before", "value": "Let's write and run a Node script."},
    {"name": "file-explorer-create-file", "value": "index.js"},
    {"name": "editor-type", "value": "console.log(2 + 2);"},
    {"name": "terminal-open", "value": "1"},
    {"name": "terminal-type", "value": "node index.js"},
    {"name": "terminal-enter", "value": "1"},
    {"name": "terminal-set-output", "value": "4"},
    {"name": "author-speak-before", "value": "Four, just like we expected."}
  ],
  "options": { "voiceId": "bf_emma", "keyboardTypingPauseMs": 20, "standardPauseMs": 600, "longPauseMs": 3000 }
}
JSON
```
