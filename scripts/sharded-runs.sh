#!/usr/bin/env bash
# Run the sharded suite N times back-to-back with a full nuke between each
# (containers + volumes + cached images), then aggregate the results.
#
# Each run produces under $OUT_DIR/run-$i/:
#   log.txt              — phase log + docker output
#   summary.txt          — npx playwright merge-reports --reporter=line output
#   merge.log            — merge container stdout
#   rancher-{1,2}.log    — rancher container stdout
#   shard-{1,2}.log      — shard container stdout
#   shard-{1,2}.zip      — blob report
#   shard-{1,2}.exit     — playwright exit code per shard
#   test-results/        — copy of the host-mounted test artifacts (failure
#                          screenshots, videos, dom-snapshots, nav-events.txt)
#   failure-summary.txt  — `yarn summarize-failures` output for this run
#
# After all runs: $OUT_DIR/AGGREGATE.txt with the tail of every summary.
#
# Usage:
#   scripts/sharded-runs.sh                              # 5 runs, default tags
#   scripts/sharded-runs.sh -n 3                         # 3 runs
#   scripts/sharded-runs.sh -t '@adminUser+-@prime'      # custom GREP_TAGS
#   scripts/sharded-runs.sh -o /tmp/my-runs              # custom output dir
#
# Defaults:
#   N         = 5
#   GREP_TAGS = @adminUser+-@prime+-@noVai+-@needsInfra+-@provisioning
#   OUT_DIR   = /tmp/sharded-runs-<unix-timestamp>
#
# Exit codes:
#   0 — all runs scripted to completion (individual run pass/fail is in summaries)
#   2 — invalid arguments

set -u

usage() {
  sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'
}

N=5
GREP_TAGS_DEFAULT='@adminUser+-@prime+-@noVai+-@needsInfra+-@provisioning'
GREP_TAGS_ARG="$GREP_TAGS_DEFAULT"
OUT_DIR=""

while getopts "n:t:o:h" opt; do
  case "$opt" in
    n) N="$OPTARG" ;;
    t) GREP_TAGS_ARG="$OPTARG" ;;
    o) OUT_DIR="$OPTARG" ;;
    h) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done

if [ -z "$OUT_DIR" ]; then
  OUT_DIR="/tmp/sharded-runs-$(date +%s)"
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# PROVIDER selects how the two Rancher instances are provisioned:
#   docker (default) — privileged rancher containers from the compose file
#   k3d              — one k3d cluster per instance via scripts/k3d-rancher.sh
PROVIDER="${PROVIDER:-docker}"

if [ "$PROVIDER" = "k3d" ]; then
  # No nix override: the rancher-nft iptables shim only exists for the docker
  # rancher image; under k3d, k3s runs inside rancher/k3s node images.
  COMPOSE_FLAGS=(-f docker-compose.sharded.yml -f docker-compose.sharded.k3d.yml)
else
  COMPOSE_FLAGS=(-f docker-compose.sharded.yml -f docker-compose.sharded.nix.yml)
fi

mkdir -p "$OUT_DIR"
cd "$REPO_ROOT" || exit 1

echo "Sharded runs: N=$N, GREP_TAGS='$GREP_TAGS_ARG', OUT_DIR=$OUT_DIR"

# A rancher startup FATAL (multiclustermanager-start race) can crash mid
# chart-catalog git clone, leaving `.git/index.lock` files that poison the
# volume: every `restart: unless-stopped` reboot then fails identically
# (`configmaps "" not found` loop) and never goes healthy. `restart` cannot
# heal a poisoned volume — only a nuke can. Wait for healthy; on timeout,
# nuke just that rancher's volume, recreate, and retry.
ensure_rancher_healthy() {
  local svc="$1"
  local container="dashboard-e2e-pw-${svc}-1"
  local volume="dashboard-e2e-pw_${svc}-data"
  local attempt
  for attempt in 1 2 3; do
    if sh "$(dirname "$0")/wait-rancher-healthy.sh" "$container"; then
      return 0
    fi
    echo "--- $svc not healthy (attempt $attempt/3) — nuking $volume + recreating ---"
    docker compose "${COMPOSE_FLAGS[@]}" rm -sf "$svc"
    docker volume rm "$volume" 2>/dev/null || true
    docker compose "${COMPOSE_FLAGS[@]}" up -d "$svc"
  done
  echo "FATAL: $svc never reached healthy after 3 attempts"
  return 1
}

# k3d twin of ensure_rancher_healthy: a failed bring-up is healed by deleting
# and recreating the whole cluster — strictly stronger than the volume nuke
# (fresh etcd, fresh PVs, fresh loadbalancer).
ensure_k3d_rancher_ready() {
  local inst="$1"
  local attempt
  for attempt in 1 2 3; do
    if bash "$(dirname "$0")/k3d-rancher.sh" up "$inst"; then
      return 0
    fi
    echo "--- $inst not ready (attempt $attempt/3) — deleting cluster + recreating ---"
    bash "$(dirname "$0")/k3d-rancher.sh" down "$inst" || true
  done
  echo "FATAL: $inst never reached ready after 3 attempts"
  return 1
}

for i in $(seq 1 "$N"); do
  RUN_DIR="$OUT_DIR/run-$i"
  mkdir -p "$RUN_DIR"

  {
    echo "==================== Run $i / $N starting ===================="
    date

    echo "--- Tear down ---"
    docker compose "${COMPOSE_FLAGS[@]}" down -v 2>/dev/null || true
    if [ "$PROVIDER" = "k3d" ]; then
      bash "$(dirname "$0")/k3d-rancher.sh" down e2e-1 || true
      bash "$(dirname "$0")/k3d-rancher.sh" down e2e-2 || true
    else
      echo "--- Remove cached images (incl. upstream base) ---"
      docker rmi rancher-nft:local rancher/rancher:v2.14-head rancher/rancher:head docker.io/rancher/rancher:head 2>/dev/null || true
    fi

    echo "--- Clear test-results + blob-report ---"
    rm -rf test-results blob-report

    if [ "$PROVIDER" = "docker" ]; then
      echo "--- Pull fresh upstream rancher head image ---"
      docker compose "${COMPOSE_FLAGS[@]}" pull rancher-1 rancher-2 2>/dev/null || \
        docker compose "${COMPOSE_FLAGS[@]}" pull 2>/dev/null || true
    fi

    if [ "$PROVIDER" = "k3d" ]; then
      echo "--- Provision k3d rancher clusters e2e-1 and e2e-2 (wait ready) ---"
      # Sequential on purpose: booting both ranchers in parallel on one host
      # pressures the multiclustermanager-start leader race — same stagger the
      # docker path gets from rancher-2's depends_on. Image freshness comes
      # from rancherImagePullPolicy=Always plus a fresh cluster per run, so
      # the docker path's rmi+pull steps have no k3d equivalent.
      ensure_k3d_rancher_ready e2e-1
      ensure_k3d_rancher_ready e2e-2

      # shellcheck disable=SC1091  # runtime handoff files written by k3d-rancher.sh
      SHARD1_TEST_BASE_URL="$(. /tmp/k3d-rancher-e2e-1.env && echo "$TEST_BASE_URL")"
      # shellcheck disable=SC1091  # runtime handoff files written by k3d-rancher.sh
      SHARD2_TEST_BASE_URL="$(. /tmp/k3d-rancher-e2e-2.env && echo "$TEST_BASE_URL")"
      export SHARD1_TEST_BASE_URL SHARD2_TEST_BASE_URL

      echo "--- Build (with --pull to force fresh FROM layer) ---"
      GREP_TAGS="$GREP_TAGS_ARG" docker compose "${COMPOSE_FLAGS[@]}" build --pull

      echo "--- Bring up shards + merge ---"
      GREP_TAGS="$GREP_TAGS_ARG" docker compose "${COMPOSE_FLAGS[@]}" up -d
    else
      echo "--- Build (with --pull to force fresh FROM layer) ---"
      GREP_TAGS="$GREP_TAGS_ARG" docker compose "${COMPOSE_FLAGS[@]}" build --pull

      echo "--- Bring up rancher-1 and rancher-2 (wait healthy) ---"
      # Two-phase up: bring the ranchers up before the shards so compose's
      # first-pass dependency check doesn't see a transient startup FATAL and
      # abort the whole run. ensure_rancher_healthy then heals the poisoned-
      # volume crash loop that `restart: unless-stopped` cannot recover from.
      GREP_TAGS="$GREP_TAGS_ARG" docker compose "${COMPOSE_FLAGS[@]}" up -d rancher-1 rancher-2
      ensure_rancher_healthy rancher-1
      ensure_rancher_healthy rancher-2

      echo "--- Bring up shards + merge ---"
      GREP_TAGS="$GREP_TAGS_ARG" docker compose "${COMPOSE_FLAGS[@]}" up -d
    fi

    echo "--- Wait for merge ---"
    start_ts=$(date +%s)
    docker wait dashboard-e2e-pw-merge-1
    end_ts=$(date +%s)
    echo "merge wait completed in $((end_ts - start_ts))s"
  } >> "$RUN_DIR/log.txt" 2>&1

  echo "--- Run $i: collect artifacts ---" >> "$RUN_DIR/log.txt"

  if [ "$PROVIDER" = "k3d" ]; then
    for c in merge-1 shard-1-1 shard-2-1; do
      docker logs "dashboard-e2e-pw-$c" > "$RUN_DIR/${c%-1}.log" 2>&1 || true
    done
    bash "$(dirname "$0")/k3d-rancher.sh" logs e2e-1 > "$RUN_DIR/rancher-1.log" 2>&1 || true
    bash "$(dirname "$0")/k3d-rancher.sh" logs e2e-2 > "$RUN_DIR/rancher-2.log" 2>&1 || true
  else
    for c in merge-1 rancher-1-1 rancher-2-1 shard-1-1 shard-2-1; do
      docker logs "dashboard-e2e-pw-$c" > "$RUN_DIR/${c%-1}.log" 2>&1 || true
    done
  fi

  docker run --rm \
    -v dashboard-e2e-pw_blob-reports:/blobs:ro \
    -v "$RUN_DIR":/out \
    alpine sh -c 'cp /blobs/shard-*.zip /out/ 2>/dev/null; cp /blobs/shard-*.exit /out/ 2>/dev/null' \
    >> "$RUN_DIR/log.txt" 2>&1 || true

  npx playwright merge-reports "$RUN_DIR" --reporter=line > "$RUN_DIR/summary.txt" 2>&1 || true

  cp -r test-results "$RUN_DIR/test-results" 2>/dev/null || true

  yarn summarize-failures "$RUN_DIR/test-results" > "$RUN_DIR/failure-summary.txt" 2>&1 || true

  {
    echo "==================== Run $i / $N complete ===================="
    date
  } >> "$RUN_DIR/log.txt"
done

# Final aggregate
{
  echo "==================== Aggregate of $N runs ===================="
  for i in $(seq 1 "$N"); do
    echo
    echo "--- Run $i summary ---"
    tail -10 "$OUT_DIR/run-$i/summary.txt" 2>/dev/null || echo "(no summary)"
  done
  echo
  echo "Output dir: $OUT_DIR"
} > "$OUT_DIR/AGGREGATE.txt"

cat "$OUT_DIR/AGGREGATE.txt"
