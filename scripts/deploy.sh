#!/usr/bin/env bash
# Invoked from the checkout root after a guarded fast-forward by deploy.yml.
set -Eeuo pipefail
umask 077
compose=(docker compose -f docker-compose.yml)
services=(staging-codevideo-api codevideo-api languagetool codevideo-tts codevideo-cli codevideo-genie nginx)
stage=validation
fail() { echo "ERROR: $*" >&2; return 1; }
diagnostics() {
  local status=$?
  trap - ERR
  echo "Deployment failed during $stage (exit $status)." >&2
  "${compose[@]}" ps -a || true
  if [[ -n "${recovery_dir:-}" ]]; then
    "${compose[@]}" logs --no-color --tail=60 > "$recovery_dir/failure.log" 2>&1 || true
    echo "Bounded diagnostic logs saved privately in $recovery_dir/failure.log" >&2
  fi
  # Logs can contain customer data: use restricted server logs for detailed review.
  echo "Inspect bounded logs on the server: docker compose -f docker-compose.yml logs --tail=60" >&2
  exit "$status"
}
trap diagnostics ERR

echo '=== Validate prerequisites ==='
command -v curl >/dev/null
command -v python3 >/dev/null
command -v pgrep >/dev/null
docker info >/dev/null
docker compose version
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || fail 'Reconcile tracked checkout edits before deploying.'
for file in .env .env.staging; do
  [[ -s "$file" ]] || fail "Missing or empty $file; provision it on the server."
done
"${compose[@]}" config --quiet
# The pre-container worker must not consume the same queue alongside this stack.
if pgrep -af '(^|/)(go-video-dispatcher|worker/codevideo)([[:space:]]|$)'; then
  fail 'Legacy host worker is running. Inspect in-flight jobs and retire it safely before starting the container worker.'
fi
# Match every active TLS certificate directive, including additional vhosts.
while read -r certificate; do
  case "$certificate" in
    /etc/nginx/ssl/*) file="certbot/conf/${certificate#/etc/nginx/ssl/}" ;;
    *) fail "Unsupported TLS certificate path: $certificate" ;;
  esac
  [[ -s "$file" ]] || fail "Missing TLS certificate/key: $file"
done < <(awk '/^[[:space:]]*ssl_certificate(_key)?[[:space:]]/ {gsub(/;/,"",$2); print $2}' nginx/conf/*.conf)
[[ -z "${DOCKERHUB_USERNAME:-}" && -z "${DOCKERHUB_TOKEN:-}" ]] || {
  [[ -n "${DOCKERHUB_USERNAME:-}" && -n "${DOCKERHUB_TOKEN:-}" ]] || fail 'Set both Docker Hub credentials or neither.'
  printf '%s' "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin
}

echo '=== Record recovery state ==='
recovery_dir=".deploy-history/$(date -u +%Y%m%dT%H%M%SZ)-$$"
mkdir -p "$recovery_dir"
printf '%s\n' "${PREVIOUS_REVISION:-$(git rev-parse HEAD)}" > "$recovery_dir/previous-revision"
git rev-parse HEAD > "$recovery_dir/target-revision"
for service in "${services[@]}"; do
  container=$("${compose[@]}" ps -a -q "$service")
  if [[ -n "$container" ]]; then
    docker inspect --format '{{.Name}} {{.Config.Image}} {{.Image}}' "$container" >> "$recovery_dir/images.txt"
  fi
done
echo "Recovery metadata: $recovery_dir (no environment values recorded)"

stage=pull
echo '=== Pull registry images (skip services built locally) ==='
"${compose[@]}" pull --ignore-buildable
stage=build
echo '=== Build local services before replacing containers ==='
"${compose[@]}" build
stage=startup
echo '=== Start long-running services (exclude Certbot) ==='
"${compose[@]}" up -d --no-build --pull never "${services[@]}"
stage=verification
echo '=== Verify services ==='
# Retry application readiness, then check that no container restarted during soak.
"${compose[@]}" exec -T nginx nginx -t
retry() {
  local attempt
  for attempt in {1..60}; do
    if "$@"; then return 0; fi
    sleep 5
  done
  return 1
}
retry curl --fail --silent --show-error --max-time 10 https://api.codevideo.io/ >/dev/null
retry "${compose[@]}" exec -T codevideo-tts node -e 'fetch("http://127.0.0.1:3000/health").then(async r => {if (!r.ok || !(await r.json()).ready) process.exit(1)}).catch(() => process.exit(1))'
retry "${compose[@]}" exec -T codevideo-genie node -e 'const net=require("node:net");const s=net.connect(3001,"127.0.0.1",()=>s.end());s.setTimeout(5000,()=>process.exit(1));s.on("error",()=>process.exit(1))'
"${compose[@]}" exec -T codevideo-cli sh -ec 'test -d /work/tmp/v3/new && test -w /work/tmp/v3/new'
"${compose[@]}" logs --no-color --tail=100 codevideo-cli | grep -q 'Watching for new manifest files'
for service in "${services[@]}"; do
  container=$("${compose[@]}" ps -a -q "$service")
  [[ -n "$container" ]] || fail "Missing container: $service"
  docker inspect --format '{{.Id}} {{.RestartCount}}' "$container" >> "$recovery_dir/startup-counts"
done
sleep 20
while read -r container restarts; do
  [[ "$(docker inspect --format '{{.State.Running}} {{.RestartCount}}' "$container")" == "true $restarts" ]] || fail "Container stopped or restarted: $container"
done < "$recovery_dir/startup-counts"
"${compose[@]}" ps
stage=cleanup
# Each build here leaves the previous image dangling. Keep a week of them for
# rollback (DEPLOYMENT.md, Recovery) and prune the rest; a prune problem must not
# fail a deploy that already passed verification.
echo '=== Prune dangling images and build cache older than 7 days ==='
docker image prune -f --filter until=168h || echo 'Image prune skipped' >&2
docker builder prune -f --filter until=168h || echo 'Build cache prune skipped' >&2
echo 'Deployment service checks passed. Complete the controlled test-account render before accepting the rollout.'
