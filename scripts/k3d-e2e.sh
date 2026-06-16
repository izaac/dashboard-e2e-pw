#!/usr/bin/env bash
# Local, CI-faithful driver for the k3d e2e flow.
#
# This is the single source of truth shared by developers and the PR workflow
# (.github/workflows/e2e-k3d-pr.yml). It resolves the branch-matched Rancher
# image / chart line / dashboard ref from branches-metadata.json, builds the
# matching rancher/dashboard dist, provisions Rancher on k3d with that dist
# mounted, and runs the suite in the tests container attached to the k3d
# network. Running it locally reproduces exactly what CI does.
#
# Prerequisites: enter the devenv shell first so node, yarn, k3d, helm,
# kubectl and docker are on PATH:
#   nix develop --impure -c scripts/k3d-e2e.sh all
#
# Usage:
#   scripts/k3d-e2e.sh <command> [-- playwright args...]
#
# Commands:
#   resolve   Print KEY=VALUE targets resolved from branches-metadata.json.
#   build     Clone/checkout the matched dashboard ref and build its dist.
#   up        Provision Rancher on k3d with the built dist mounted.
#   test      Run the suite in the tests container (docker -> k3d network).
#   down      Tear down the cluster and remove the built dist.
#   all       build + up + test.
#
# Parameters (environment variables):
#   BASE            Branch key to resolve in branches-metadata.json (default main).
#   DASHBOARD_REF   Override the dashboard ref to build (default from metadata).
#   INSTANCE        k3d instance name: e2e or e2e-<n> (default e2e).
#   GREP_TAGS       Playwright tag filter for `test` (e.g. @generic).
#   DASHBOARD_DIST  Override the dist path mounted into Rancher (default the
#                   dist produced by `build`).
#   SKIP_BUILD      If set to 1, `up`/`all` reuse an existing dist (no rebuild).
#   NODE_IMAGE      Container image used to build the dist (default node:<.nvmrc>).
#
# Why the dist is built in a container: rancher/dashboard's build scripts use
# absolute `#!/bin/bash` shebangs, which do not exist on non-FHS hosts (NixOS).
# Building inside the node image gives every developer the same FHS toolchain
# CI uses, and `-u $(id -u)` keeps the produced files owned by the developer
# rather than root.
#
# Handoff: `up` writes /tmp/k3d-rancher-<instance>.env (via k3d-rancher.sh) for
# the tests container to consume.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

BASE="${BASE:-main}"
INSTANCE="${INSTANCE:-e2e}"
METADATA="${REPO_ROOT}/branches-metadata.json"
DASHBOARD_SRC="${REPO_ROOT}/dashboard-src"
DIST_DIR="${DASHBOARD_SRC}/dist"

log() { echo "--- $* ---" >&2; }
fatal() { echo "FATAL: $*" >&2; exit 1; }

require() {
  command -v "$1" >/dev/null 2>&1 || fatal "$1 not in PATH (enter devenv shell: nix develop --impure)"
}

# Resolve the branch-matched targets from branches-metadata.json. Unknown
# branches fall back to main's entry, mirroring the upstream mechanism. The
# dashboard ref is mandatory: without it a run would validate against the
# image's CDN dashboard (unrelated code) instead of the branch's source line.
resolve() {
  require jq
  [ -f "$METADATA" ] || fatal "branches-metadata.json not found at $METADATA"

  if [ "$(jq -r --arg b "$BASE" '.branches | has($b)' "$METADATA")" != "true" ]; then
    echo "::warning::no branches-metadata.json entry for '$BASE' — falling back to main" >&2
  fi

  local entry tag release repo ref sha
  entry="$(jq -c --arg b "$BASE" '.branches[$b] // .branches.main' "$METADATA")"
  tag="$(echo "$entry" | jq -r '.e2e["rancher-image"].tag')"
  release="$(echo "$entry" | jq -r '.e2e["chart-release"]')"
  repo="$(echo "$entry" | jq -r '.e2e.dashboard.repo // empty')"
  ref="${DASHBOARD_REF:-$(echo "$entry" | jq -r '.e2e.dashboard.ref // empty')}"

  [ -n "$repo" ] && [ -n "$ref" ] || fatal "branches-metadata.json has no .e2e.dashboard.{repo,ref} for '$BASE'"

  # SHA is only needed for CI's dist cache key. Resolve it when gh is available
  # and authenticated; locally the ref alone is enough to clone.
  sha=""
  if command -v gh >/dev/null 2>&1; then
    sha="$(gh api "repos/${repo}/commits/${ref}" --jq .sha 2>/dev/null || true)"
  fi

  echo "RANCHER_IMAGE_TAG=${tag}"
  echo "RANCHER_RELEASE=${release}"
  echo "DASHBOARD_REPO=${repo}"
  echo "DASHBOARD_REF=${ref}"
  echo "DASHBOARD_SHA=${sha}"
}

# Load resolved targets into the current shell.
load_targets() {
  local line
  while IFS= read -r line; do
    [ -n "$line" ] && export "${line?}"
  done < <(resolve)
}

build() {
  require git
  require docker
  load_targets

  if [ -d "$DIST_DIR" ] && [ -n "$(ls -A "$DIST_DIR" 2>/dev/null)" ] && [ "${SKIP_BUILD:-}" = "1" ]; then
    log "SKIP_BUILD=1 and dist present — reusing ${DIST_DIR}"
    return 0
  fi

  if [ -d "${DASHBOARD_SRC}/.git" ]; then
    log "dashboard-src present — fetching ${DASHBOARD_REPO}@${DASHBOARD_REF}"
    git -C "$DASHBOARD_SRC" fetch --depth 1 origin "$DASHBOARD_REF"
    git -C "$DASHBOARD_SRC" checkout -f FETCH_HEAD
  else
    rm -rf "$DASHBOARD_SRC"
    log "cloning ${DASHBOARD_REPO}@${DASHBOARD_REF} into dashboard-src"
    git clone --depth 1 --branch "$DASHBOARD_REF" \
      "https://github.com/${DASHBOARD_REPO}.git" "$DASHBOARD_SRC"
  fi

  rm -rf "$DIST_DIR" "${DASHBOARD_SRC}/dist_ember"

  local node_image="${NODE_IMAGE:-node:$(cat "${DASHBOARD_SRC}/.nvmrc" 2>/dev/null | tr -d '[:space:]')}"
  log "building dashboard dist in ${node_image} (yarn install --frozen-lockfile && yarn e2e:build)"
  # Build in the node image so the dashboard's /bin/bash build scripts run on an
  # FHS toolchain; run as the host user so dist files are not root-owned; HOME
  # under /tmp keeps yarn's cache writable for the non-root uid. The dashboard
  # build's ember step shells out to jq, which the node image lacks, so drop a
  # static jq on PATH (no root / apt needed for the non-root uid).
  docker run --rm \
    -u "$(id -u):$(id -g)" \
    -e HOME=/tmp \
    -v "${DASHBOARD_SRC}:/work" \
    -w /work \
    "$node_image" \
    bash -ceu '
      arch="$(dpkg --print-architecture)"
      curl -fsSL -o /tmp/jq "https://github.com/jqlang/jq/releases/download/jq-1.7.1/jq-linux-${arch}"
      chmod +x /tmp/jq
      export PATH="/tmp:${PATH}"
      yarn install --frozen-lockfile && yarn e2e:build
    '
  log "dist ready: ${DIST_DIR}"
}

up() {
  require k3d
  require helm
  load_targets

  local dist="${DASHBOARD_DIST:-$DIST_DIR}"
  [ -d "$dist" ] && [ -n "$(ls -A "$dist" 2>/dev/null)" ] || \
    fatal "no dashboard dist at ${dist} — run '$0 build' first"

  log "provisioning rancher on k3d (${INSTANCE}) with branch-matched dashboard"
  RANCHER_IMAGE_TAG="$RANCHER_IMAGE_TAG" \
  RANCHER_RELEASE="$RANCHER_RELEASE" \
  DASHBOARD_DIST="$dist" \
    bash "${REPO_ROOT}/scripts/k3d-rancher.sh" up "$INSTANCE"
}

test_run() {
  require docker
  local env_file="/tmp/k3d-rancher-${INSTANCE}.env"
  [ -f "$env_file" ] || fatal "no handoff at ${env_file} — run '$0 up' first"

  log "running suite (GREP_TAGS='${GREP_TAGS:-}') via docker -> k3d network"
  HOST_UID="$(id -u)" HOST_GID="$(id -g)" \
    bash "${REPO_ROOT}/scripts/k3d-run.sh" "$@"
}

down() {
  if command -v k3d >/dev/null 2>&1; then
    log "tearing down k3d instance ${INSTANCE}"
    bash "${REPO_ROOT}/scripts/k3d-rancher.sh" down "$INSTANCE" || true
  fi
  if [ -d "$DIST_DIR" ]; then
    log "removing built dist ${DIST_DIR}"
    rm -rf "$DIST_DIR"
  fi
}

main() {
  local cmd="${1:-}"
  shift || true
  # Allow `-- playwright args` after the command for `test`/`all`.
  [ "${1:-}" = "--" ] && shift || true

  case "$cmd" in
    resolve) resolve ;;
    build)   build ;;
    up)      up ;;
    test)    test_run "$@" ;;
    down)    down ;;
    all)     build; up; test_run "$@" ;;
    *)
      sed -n '2,46p' "$0" | sed 's/^# \{0,1\}//' >&2
      exit 2
      ;;
  esac
}

main "$@"
