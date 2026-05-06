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
COMPOSE_FLAGS=(-f docker-compose.sharded.yml -f docker-compose.sharded.nix.yml)

mkdir -p "$OUT_DIR"
cd "$REPO_ROOT"

echo "Sharded runs: N=$N, GREP_TAGS='$GREP_TAGS_ARG', OUT_DIR=$OUT_DIR"

for i in $(seq 1 "$N"); do
  RUN_DIR="$OUT_DIR/run-$i"
  mkdir -p "$RUN_DIR"

  {
    echo "==================== Run $i / $N starting ===================="
    date

    echo "--- Tear down ---"
    docker compose "${COMPOSE_FLAGS[@]}" down -v

    echo "--- Remove cached images ---"
    docker rmi rancher-nft:local rancher/rancher:v2.14-head 2>/dev/null || true

    echo "--- Clear test-results + blob-report ---"
    rm -rf test-results blob-report

    echo "--- Bring up (fresh build + pull) ---"
    GREP_TAGS="$GREP_TAGS_ARG" docker compose "${COMPOSE_FLAGS[@]}" up --build -d

    echo "--- Wait for merge ---"
    start_ts=$(date +%s)
    docker wait dashboard-e2e-pw-merge-1
    end_ts=$(date +%s)
    echo "merge wait completed in $((end_ts - start_ts))s"
  } >> "$RUN_DIR/log.txt" 2>&1

  echo "--- Run $i: collect artifacts ---" >> "$RUN_DIR/log.txt"

  for c in merge-1 rancher-1-1 rancher-2-1 shard-1-1 shard-2-1; do
    docker logs "dashboard-e2e-pw-$c" > "$RUN_DIR/${c%-1}.log" 2>&1 || true
  done

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
