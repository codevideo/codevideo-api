# Deployment State — api.codevideo.io (`fullstackcraft` host)

Snapshot from the B0 audit, 2026-06-12. This answers "what is actually running
in production" so the worker migration (go-video-dispatcher → codevideo-cli)
starts from facts rather than memory.

> **Update (2026-07):** the migration landed as a **containerized** worker, not a
> host process. `codevideo-cli` now runs in the compose stack as the `codevideo-cli`
> service, pulled from Docker Hub (`fullstackcraft/codevideo-cli`) and sharing the
> `tmp/v3` queue. This supersedes the "host systemd unit" framing below: container
> `restart: always` + `init: true` provide the supervision the audit called for.

## What is live

| Piece | State |
|---|---|
| Checkout | `/root/codevideo-api` at `474cf18` (= origin/main, "add needed config for pricearb server", 2026-01-07) |
| Server-side drift | `nginx/conf/api.fullstackcraft.com.conf` has an **uncommitted edit on the server** (+ untracked certbot dirs, expected). Rescue the nginx edit before any redeploy or it is lost. |
| docker containers | `codevideo-api` (:7000), `staging-codevideo-api` (:6999), `gatsby-static-server` (:7001) — all images built 2026-01-07 16:38, up since then |
| API internals | package 1.0.0, `@fullstackcraftllc/codevideo-types` **2.0.41**; ELEVEN_LABS / CODEVIDEO_S3 / CLERK env all set |
| tmp/v3 queue | bind mount `/root/codevideo-api/tmp/v3` ↔ container `/usr/src/app/tmp/v3` |
| **Video worker** | **`./go-video-dispatcher`** — bare process (PID 1423769), started **2025-03-19 20:59**, binary built 2025-03-19, cwd `/root/codevideo-api/go-video-dispatcher`. NOT the newer codevideo-cli. |
| Worker supervision | **None.** No systemd unit, no crontab. The worker survives on host uptime alone — a reboot silently stops all video generation. |

## Pipeline health

- Last **successful** render: **2026-02-27 19:55** (`tmp/v3/success/`, hundreds of manifests total).
- `tmp/v3/error/` is **empty since 2025-03** — the dispatcher apparently never
  writes error manifests; failed jobs just vanish or stick.
- **Three manifests are stuck in `tmp/v3/new/`** (i.e. accepted but never
  rendered): `ca4ba596…` (2025-11-11), `154d0a01…` (2026-01-26),
  `988cb321…` (2026-02-07). Later jobs (through Feb 27) still succeeded, so the
  dispatcher skips/hangs per-job rather than wedging entirely.
  **Check whether these were paying customers** — if `/create-video-v3`
  accepted them, tokens were checked and the user was told "you'll get an
  email", which never came.
- A **leaked headless Chromium** (PID 3496143) has been alive since
  **2025-07-23** (~381h CPU) — a render from that day whose browser never
  closed. Safe to kill once confirmed nothing else owns it; it documents the
  dispatcher's per-job hang/leak mode.

## Implications for the migration (Plan B)

1. **B5 is a worker replacement, not an update-in-place**: retire
   `go-video-dispatcher` in favor of `codevideo -m serve`. Shipped as the
   containerized `codevideo-cli` compose service (see the update note above);
   `restart: always` supervises it, fixing the no-supervision fragility.
2. The local repo's pending deletion of `go-video-dispatcher/` is correct for
   git, but **do not delete that directory on the server** until the CLI
   worker is live — the running binary, its puppeteer-runner node_modules, and
   the chrome extension live there.
3. The API containers are current with the repo, so the API side of B1 (types
   2.0.41 → 2.1.x, Project-union payload) is a normal rebuild + redeploy.
4. The CLI worker must match or beat the dispatcher on the failure modes
   observed here: per-job timeouts (no eternal Chromium), error manifests
   written to `error/` (no silently vanishing jobs), and ideally a startup
   sweep of stale `new/` manifests.

## Open items from the audit

- [ ] Rescue/commit the server's `api.fullstackcraft.com.conf` edit
- [ ] Inspect the 3 stuck manifests (`cat tmp/v3/new/*.json`) — refund/re-run?
- [ ] Kill leaked Chromium PID 3496143 after confirming it's orphaned
- [x] Supervise the `codevideo -m serve` worker — done via the `codevideo-cli`
      compose service (`restart: always` + `init: true`), not a host systemd unit

## Experimental deterministic renderer rollout

The deterministic renderer is developed in the sibling `codevideo-types`,
`codevideo-ide-react` and `codevideo-cli` repositories. It remains opt-in; existing
manifests and the worker default use realtime capture. No new public API control
is introduced by this change.

Release types first, then update/release React, rebuild its Gatsby `/v3` page,
copy the generated site into the CLI's embedded `public/`, and release the CLI
binary **with** `renderFramesV1.js`, `virtualClock.js` and their Node dependencies.
Only then update the `codevideo-cli` image pin in `docker-compose.yml` to the
published image. That release is 0.0.9 (2026-10-29). The pin now uses 0.0.12:
0.0.10 moved the image to Chromium 142 after 0.0.9 failed every realtime render,
0.0.11 moves every failed job's manifest to `tmp/v3/error`, and 0.0.12 renders
each job in its own `videoOptions.orientation` (portrait API requests).
The runtime must include Chrome, Node, FFmpeg and ffprobe.

A controlled manifest can set `renderMode: "deterministic"`, `renderSeed` and
`renderWorkers`. Mode precedence is manifest → `CODEVIDEO_RENDER_MODE` → realtime.
Use a separate queue/worker for staging experiments: this compose stack's worker
currently consumes **both production and staging** from `tmp/v3/new`. Setting its
`CODEVIDEO_RENDER_MODE=deterministic` would opt all manifests without explicit mode
into the experiment. Keep that shared default realtime.

Browser concurrency multiplies across jobs. Start with one concurrent job and
one browser worker, inspect trace/timing sidecars, then tune against available RAM.
Do not copy the M3 Max's local 4/8-worker settings onto the smaller production
host without measuring. External websites and executable previews remain best
effort under virtual time. The CLI's `docs/deterministic-rendering.md` documents
limitations, local golden benchmarks and the full release checklist.

## Reliable Actions deployment

The API repository deploys the stack; the separate `codevideo/codevideo-cli`
repository publishes its render-worker image. Actions secrets are repository
specific. Configure `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` in **both** repos:
read-only permission is sufficient in the API repo; the CLI publisher needs write
permission to `fullstackcraft/codevideo-cli`. Create that Docker Hub repository
first if it does not exist. Login success alone does not establish image access.

Release sequence:

1. Merge the CLI publishing workflow repair. Validate committed CLI source in an
   isolated checkout, excluding local renderer changes (`go test ./...`, Docker
   build, and the isolated-queue smoke test in the publishing workflow).
2. Check remote `v0.0.8`. If absent, create it at the validated committed source;
   never move an existing tag. Pushing a `v*` tag also triggers the npm Release
   workflow: verify package versions and release prerequisites before doing so.
3. Run the Docker image workflow on the release tag, or dispatch the repaired
   workflow from main with `release_tag=v0.0.8` to recover a missing image. It
   refuses to overwrite an existing release image. Verify the published source
   revision and both amd64/arm64 manifest entries.
4. On the deployment server, verify the exact pin with
   `docker pull fullstackcraft/codevideo-cli:0.0.8` using the deploy user's login.
5. Reconcile tracked server edits before enabling the repaired API deploy. The
   retired `api.fullstackcraft.com` vhost is disabled in the repaired checkout to
   match production. Back up its existing server version outside the checkout,
   verify it matches the disabled intent, and restore only that tracked file
   before pulling the matching committed repair. Never reset the entire checkout.
6. Merge the API repair and run Deploy against latest main. The workflow rejects
   stale runs and tracked edits. It explicitly uses `docker-compose.yml` so a
   development override cannot expose production-only internal ports.

Provision `.env`, `.env.staging`, and the certificates referenced by active nginx
vhosts on the server first. Compose configuration is validated without displaying
environment values. Pulls skip locally buildable images; all builds finish before
container replacement. Certbot is a manual maintenance command, not a daemon
started by deployment. After verification passes, deploy prunes dangling images
and build cache older than 7 days; tagged images and anything newer stay.

Disk hygiene (FUL-265): every service's json-file log is capped at 3 x 50 MB in
`docker-compose.yml`, and the production API (`TMP_VIDEO_CLEANUP=true`) removes
entries older than 24 h from `tmp/v3/video` at startup and hourly, because the
worker leaves each job's webm/mp4 there after uploading to S3. The host disk is
shared with other projects, so check `df -h /` when renders or deploys fail.

The SSH command timeout is 30 minutes. Verification checks HTTPS, nginx syntax,
TTS model readiness, Genie's listener, worker queue startup, and container restart
stability. Failure prints status and saves bounded logs privately under the
reported `.deploy-history/<run>/failure.log`; these logs may contain customer data.
No environment dump is written. Deployment service checks do not prove that
rendering, S3 delivery, email, or token accounting work: use a designated test
account to submit one short render and verify its output, success manifest, and
expected completion behavior before accepting the rollout.

### Recovery

Each deploy records the previous and target Git revisions and running container
image IDs under `.deploy-history/<run>/` before pulling/building. Keep these files
and old Docker images until the controlled render passes; deploys only prune
dangling images older than 7 days, so roll back within that window. After a startup or
verification failure, inspect `docker compose -f docker-compose.yml ps -a` and the
private bounded failure log. Do not blindly retry or automatically roll back a
worker that may already be consuming the shared production/staging queue.

For manual recovery, first inspect in-flight jobs and stop the worker when safe.
Check out the recorded previous committed revision without discarding server
edits. For each row in `images.txt`, restore its original image reference with
`docker tag <recorded-image-id> <recorded-image-reference>`. Start only the services
present in that revision using `docker compose -f docker-compose.yml up -d
--no-build --pull never <explicit-service-list>`, excluding Certbot. If the prior
stack used a bare dispatcher instead of a worker container, do not run both queue
consumers. Verify nginx, HTTPS, and queue ownership before resuming renders.

Before the first container-worker deployment, inspect the existing host worker
(`/root/codevideo-api/worker/codevideo -m serve`) and in-flight jobs. The deploy
refuses to start while that legacy consumer is running. Retire it safely only
after the replacement image is verified; never run both against `tmp/v3/new`.
