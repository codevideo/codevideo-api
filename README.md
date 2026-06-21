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

## Per-app local dev (non-docker)

Each app is a standalone Node/TypeScript project:

```bash
cd codevideo-api   # or codevideo-genie / codevideo-tts
npm install
node --env-file=../.env <entry>   # load the central env (Node 20+)
```

`docker compose up` is the supported path; the above is for iterating on one service.

## CI / CD

- **CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) — on PRs into main
  and pushes to other branches: per-app `npm ci` + type-check (+ test/build where
  defined).
- **Deploy** ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) — on
  push to `main` (or manual dispatch): SSH to the host and
  `git pull --ff-only && docker compose up -d --build`. Requires the `DEPLOY_*`
  secrets listed in that file. See [DEPLOYMENT.md](DEPLOYMENT.md) for server state
  and pre-reqs.
