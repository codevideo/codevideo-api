# Deployment State — api.codevideo.io (`fullstackcraft` host)

Snapshot from the B0 audit, 2026-06-12. This answers "what is actually running
in production" so the worker migration (go-video-dispatcher → codevideo-cli)
starts from facts rather than memory.

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
   `go-video-dispatcher` in favor of `codevideo -m serve`, under a **systemd
   unit** (fixes the no-supervision fragility at the same time).
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
- [ ] Decide systemd unit spec for the future `codevideo -m serve` worker
