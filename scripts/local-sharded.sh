#!/usr/bin/env bash
# Sharded local runner: one Rancher per shard.
#
# Each shard gets its own muster-provisioned Rancher (instances e2e-1..e2e-N,
# each on its own k3d network) and runs in its own container with
# `playwright test --shard=i/N`. Per-shard blob reports are merged into one HTML
# report at the end. Sharding against a single Rancher would let the parallel
# shards mutate shared global state (settings, branding, users), so every shard
# is isolated end to end.
#
# In CI a single shared Rancher is typical; this wrapper exists so a developer
# can fan out across several local clusters. The host needs only a Docker- or
# Podman-compatible daemon plus muster's provisioning tools; the tests run in
# containers (no host Node, Yarn, or browser install).
#
# Subcommands:
#   up      Provision the N Rancher instances and keep them running.
#   test    Provision if needed, run all shards, then merge the reports.
#   down    Tear down the N Rancher instances.
#
# Environment:
#   SHARDS          Number of shards / Rancher instances. Default: 2.
#   INSTANCE_PREFIX muster instance prefix; shard i is <prefix>-i. Default: e2e.
#   PROVIDER        muster substrate provider. Default: k3d.
#   GREP_TAGS       Playwright tag filter (e.g. @navigation).
#   EXTERNAL        Provisioning intent; provisions each Rancher in external mode
#                   and defaults GREP_TAGS to @provisioning (see local-common.sh).
#   FRESH           Tear down and reprovision instances before running.
#   DOCKER_HOST     Honoured as-is when set; on a Podman host with none set, the
#                   rootful socket is selected automatically.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck source=scripts/local-common.sh
. "$REPO_ROOT/scripts/local-common.sh"

PROVIDER="${PROVIDER:-k3d}"
INSTANCE_PREFIX="${INSTANCE_PREFIX:-e2e}"
SHARDS="${SHARDS:-2}"
COMPOSE="$REPO_ROOT/docker-compose.pw.yml"

case "$SHARDS" in
  '' | *[!0-9]*) die "SHARDS must be a positive integer (got '$SHARDS')" ;;
esac
[ "$SHARDS" -ge 1 ] || die "SHARDS must be >= 1"

shard_instance() { printf '%s-%d' "$INSTANCE_PREFIX" "$1"; }

ensure_all_up() {
  local i
  for i in $(seq 1 "$SHARDS"); do
    ensure_up "$(shard_instance "$i")"
  done
}

down_all() {
  local i
  for i in $(seq 1 "$SHARDS"); do
    "$MUSTER" down --provider "$PROVIDER" --instance "$(shard_instance "$i")" || true
  done
}

# Run a single shard in its own compose project against its own Rancher. Sources
# the shard instance's handoff inside this (subshell) call so each shard gets its
# own TEST_BASE_URL. Exits with the suite's status; cleanup runs regardless.
run_one_shard() {
  local i="$1" inst="$2"
  local project="pw-shard-$i"
  local status=0

  eval "$("$MUSTER" env --provider "$PROVIDER" --instance "$inst" --out cypress)"
  export TEST_BASE_URL CATTLE_BOOTSTRAP_PASSWORD TEST_PASSWORD TEST_USERNAME
  export K3D_NETWORK PW_REPO_PATH HOST_UID HOST_GID PW_REPORTER PW_EXTRA
  export PLAYWRIGHT_BLOB_OUTPUT_DIR
  K3D_NETWORK="$(k3d_network "$inst")"
  PW_REPO_PATH="$REPO_ROOT"
  HOST_UID="$(id -u)"
  HOST_GID="$(id -g)"
  PW_REPORTER="blob"
  PW_EXTRA="--shard=$i/$SHARDS"
  # Each shard writes its blob report to its own dir to avoid clobbering the
  # others; run_sharded collects the zips afterwards.
  PLAYWRIGHT_BLOB_OUTPUT_DIR="blob-report/shard-$i"

  echo "--- shard $i/$SHARDS -> $inst ($K3D_NETWORK) $TEST_BASE_URL ---"
  docker compose -p "$project" -f "$COMPOSE" up \
    --abort-on-container-exit --exit-code-from tests tests || status=$?
  docker compose -p "$project" -f "$COMPOSE" down --remove-orphans >/dev/null 2>&1 || true
  return "$status"
}

merge_reports() {
  echo "--- Merging $SHARDS shard reports into playwright-report ---"
  export K3D_NETWORK PW_REPO_PATH HOST_UID HOST_GID
  # merge needs no Rancher; point at an existing shard network so compose never
  # rejects the external network definition.
  K3D_NETWORK="$(k3d_network "$(shard_instance 1)")"
  PW_REPO_PATH="$REPO_ROOT"
  HOST_UID="$(id -u)"
  HOST_GID="$(id -g)"
  docker compose -p pw-merge -f "$COMPOSE" --profile merge up \
    --abort-on-container-exit --exit-code-from merge merge
  docker compose -p pw-merge -f "$COMPOSE" --profile merge down --remove-orphans >/dev/null 2>&1 || true
}

run_sharded() {
  apply_external_tag_defaults
  ensure_all_up

  # Build the runner image once; all shard projects reuse the fixed image tag.
  PW_REPO_PATH="$REPO_ROOT" K3D_NETWORK="$(k3d_network "$(shard_instance 1)")" \
    docker compose -f "$COMPOSE" build tests

  rm -rf "$REPO_ROOT/blob-report"
  mkdir -p "$REPO_ROOT/blob-report" "$REPO_ROOT/test-results" "$REPO_ROOT/playwright-report"

  local i inst overall=0
  local -a pids=()
  local -a insts=()
  for i in $(seq 1 "$SHARDS"); do
    inst="$(shard_instance "$i")"
    insts[i]="$inst"
    run_one_shard "$i" "$inst" &
    pids[i]=$!
  done

  for i in $(seq 1 "$SHARDS"); do
    if wait "${pids[i]}"; then
      echo "--- shard $i (${insts[i]}) passed ---"
    else
      echo "--- shard $i (${insts[i]}) failed (exit $?) ---" >&2
      overall=1
    fi
  done

  collect_shard_reports
  merge_reports
  return "$overall"
}

# Flatten each shard's blob zip into blob-report/ so the merge service finds them
# all in one place; the per-shard subdirs (and their intermediate files) are then
# discarded.
collect_shard_reports() {
  local i dir
  for i in $(seq 1 "$SHARDS"); do
    dir="$REPO_ROOT/blob-report/shard-$i"
    [ -d "$dir" ] || continue
    find "$dir" -maxdepth 1 -name '*.zip' -exec mv -t "$REPO_ROOT/blob-report/" {} +
    rm -rf "$dir"
  done
}

main() {
  local cmd="${1:-}"
  [ "$#" -gt 0 ] && shift || true
  MUSTER="$(find_muster)"
  select_docker_host

  case "$cmd" in
    up)
      apply_external_tag_defaults
      ensure_all_up
      ;;
    test) run_sharded ;;
    down) down_all ;;
    *) die "usage: local-sharded.sh {up|test|down}  (SHARDS=N)" ;;
  esac
}

main "$@"
