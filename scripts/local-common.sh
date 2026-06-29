#!/usr/bin/env bash
# Shared helpers for the local muster-driven runners (scripts/local.sh and
# scripts/local-sharded.sh). Sourced, not executed.
#
# Environment honoured by these helpers:
#   MUSTER     Path to the muster executable. Default: the ./muster symlink in
#              the repo, else `muster` on PATH.
#   PROVIDER   muster substrate provider. Default: k3d.
#   DASHBOARD_DIST / REPO / VERSION  Optional muster `up` overrides.
#   PREFER_STAGING  Keep-fresh: when set truthy and VERSION is a rolling head
#              tag, let muster auto-promote the backend to a newer SUSE staging
#              build. A concrete VERSION pin always wins. Default: off.

die() {
  echo "ERROR: $*" >&2
  exit 1
}

find_muster() {
  if [ -n "${MUSTER:-}" ]; then
    printf '%s' "$MUSTER"
    return
  fi
  if [ -x "$REPO_ROOT/muster/muster" ]; then
    printf '%s' "$REPO_ROOT/muster/muster"
    return
  fi
  if command -v muster >/dev/null 2>&1; then
    command -v muster
    return
  fi
  die "muster not found. Set MUSTER=/path/to/muster, add the ./muster symlink, or install muster on PATH."
}

# The docker CLI may be a Podman shim whose `--version` hides the name, so detect
# Podman by resolving the binary.
is_podman_cli() {
  command -v docker >/dev/null 2>&1 || return 1
  local real
  real="$(readlink -f "$(command -v docker)" 2>/dev/null || true)"
  case "$real" in
    *podman*) return 0 ;;
  esac
  docker --version 2>/dev/null | grep -qi podman
}

# On a Podman host the substrate must be rootful (Rancher's jailer creates device
# nodes, which a rootless user namespace cannot). Target the rootful socket when
# DOCKER_HOST is unset, and override it when DOCKER_HOST points at a rootless
# socket (unusable for Rancher). Real Docker hosts, and an explicit rootful
# endpoint, are left untouched so muster (k3d) and the test containers share one
# daemon.
select_docker_host() {
  is_podman_cli || return 0
  case "${DOCKER_HOST:-}" in
    "") : ;;
    *run/user/*)
      echo "--- Podman rootless socket in DOCKER_HOST; switching to rootful (Rancher's jailer needs root) ---"
      ;;
    *)
      return 0
      ;;
  esac
  if [ -S /run/podman/podman.sock ]; then
    export DOCKER_HOST="unix:///run/podman/podman.sock"
    echo "--- Podman: using rootful socket $DOCKER_HOST ---"
  else
    die "Podman host needs the rootful socket. Enable it (e.g. sudo systemctl enable --now podman.socket) or set DOCKER_HOST to a usable endpoint."
  fi
}

# muster names the k3d network after the instance: instance e2e -> k3d-e2e.
k3d_network() { printf 'k3d-%s' "$1"; }

# True for 1/true/yes/on (case-insensitive).
is_truthy() {
  case "$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')" in
    1 | true | yes | on) return 0 ;;
    *) return 1 ;;
  esac
}

# Preserve the CI tag contract: a normal (internal) run targets tests that need
# no infra, while EXTERNAL signals provisioning intent. The repo .env filters
# @needsInfra/@provisioning out by default, and a shell GREP_TAGS overrides it,
# so when EXTERNAL is set without an explicit filter we default to @provisioning.
apply_external_tag_defaults() {
  if is_truthy "${EXTERNAL:-}" && [ -z "${GREP_TAGS:-}" ]; then
    GREP_TAGS='@provisioning'
    export GREP_TAGS
    echo "--- EXTERNAL: defaulting GREP_TAGS=@provisioning ---"
  fi
}

provisioned() {
  "$MUSTER" env --provider "${PROVIDER:-k3d}" --instance "$1" --out cypress >/dev/null 2>&1
}

ensure_up() {
  local instance="$1"
  if is_truthy "${FRESH:-}" && provisioned "$instance"; then
    echo "--- FRESH: tearing down existing ${PROVIDER:-k3d}/$instance ---"
    "$MUSTER" down --provider "${PROVIDER:-k3d}" --instance "$instance" >/dev/null 2>&1 || true
  fi
  if provisioned "$instance"; then
    echo "--- Reusing existing ${PROVIDER:-k3d}/$instance ---"
    return
  fi
  echo "--- Provisioning Rancher (${PROVIDER:-k3d}/$instance) ---"
  local up_args=(--provider "${PROVIDER:-k3d}" --instance "$instance" --out cypress)
  [ -n "${DASHBOARD_DIST:-}" ] && up_args+=(--dashboard-dist "$DASHBOARD_DIST")
  [ -n "${REPO:-}" ] && up_args+=(--repo "$REPO")
  [ -n "${VERSION:-}" ] && up_args+=(--version "$VERSION")
  is_truthy "${PREFER_STAGING:-}" && up_args+=(--prefer-staging)
  # EXTERNAL == provisioning intent: muster pins server-url behind a cloudflared
  # tunnel so downstream nodes can register back. Internal runs skip it.
  is_truthy "${EXTERNAL:-}" && up_args+=(--external)
  "$MUSTER" up "${up_args[@]}"
}
