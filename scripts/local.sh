#!/usr/bin/env bash
# Local developer entrypoint: provision Rancher with muster and run the
# Playwright suite inside a container (docker-compose.pw.yml). The host needs
# only a Docker- or Podman-compatible daemon plus muster's provisioning tools
# (k3d, kubectl, helm); it needs no Node, Yarn, or browser install, because the
# tests run in the container.
#
# Subcommands:
#   up      Provision Rancher (muster up) and keep it running.
#   test    Provision if needed, then run the suite in a container. Extra args
#           are passed through to `playwright test` (e.g. -g "name").
#   down    Tear down Rancher (muster down).
#   report  Serve the last HTML report from a container on $REPORT_PORT.
#
# Environment:
#   MUSTER     Path to the muster executable. Default: the ./muster symlink in
#              the repo, else `muster` on PATH.
#   PROVIDER   muster substrate provider. Default: k3d.
#   INSTANCE   muster instance name. Default: e2e.
#   GREP_TAGS  Playwright tag filter (e.g. @navigation).
#   REPORT_PORT  Host port for `report`. Default: 9323.
#   DOCKER_HOST  Honoured as-is when set. On a Podman host with none set, the
#                rootful socket is selected automatically (the substrate must be
#                rootful: Rancher's jailer needs real device-node creation).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck source=scripts/local-common.sh
. "$REPO_ROOT/scripts/local-common.sh"

PROVIDER="${PROVIDER:-k3d}"
INSTANCE="${INSTANCE:-e2e}"
REPORT_PORT="${REPORT_PORT:-9323}"

run_tests() {
  apply_external_tag_defaults
  ensure_up "$INSTANCE"
  eval "$("$MUSTER" env --provider "$PROVIDER" --instance "$INSTANCE" --out cypress)"
  export TEST_BASE_URL CATTLE_BOOTSTRAP_PASSWORD TEST_PASSWORD TEST_USERNAME
  export GREP_TAGS="${GREP_TAGS:-}"
  export K3D_NETWORK PW_REPO_PATH HOST_UID HOST_GID
  K3D_NETWORK="$(k3d_network "$INSTANCE")"
  PW_REPO_PATH="$REPO_ROOT"
  HOST_UID="$(id -u)"
  HOST_GID="$(id -g)"

  mkdir -p "$REPO_ROOT/test-results" "$REPO_ROOT/playwright-report"

  echo "--- Running Playwright in a container (GREP_TAGS=${GREP_TAGS:-<all>}) ---"
  echo "    TEST_BASE_URL=$TEST_BASE_URL"
  echo "    network=$K3D_NETWORK"
  # `up --exit-code-from` streams container logs and returns the suite's exit
  # code. We avoid `compose run` because Podman's Docker-compatible API rejects
  # its TTY attach/hijack ("unable to upgrade to tcp, received 500"); `up` works
  # on both Docker and Podman. Extra args ride along via PW_EXTRA.
  export PW_EXTRA="$*"
  local status=0
  docker compose -f "$REPO_ROOT/docker-compose.pw.yml" up \
    --build --abort-on-container-exit --exit-code-from tests tests || status=$?
  docker compose -f "$REPO_ROOT/docker-compose.pw.yml" down --remove-orphans >/dev/null 2>&1 || true
  return "$status"
}

serve_report() {
  export K3D_NETWORK PW_REPO_PATH HOST_UID HOST_GID
  K3D_NETWORK="$(k3d_network "$INSTANCE")"
  PW_REPO_PATH="$REPO_ROOT"
  HOST_UID="$(id -u)"
  HOST_GID="$(id -g)"
  : "${TEST_BASE_URL:=http://localhost}"
  export TEST_BASE_URL
  export REPORT_PORT
  echo "--- Serving report on http://localhost:$REPORT_PORT (Ctrl-C to stop) ---"
  docker compose -f "$REPO_ROOT/docker-compose.pw.yml" --profile report up --build report
}

main() {
  local cmd="${1:-}"
  [ "$#" -gt 0 ] && shift || true
  MUSTER="$(find_muster)"
  select_docker_host

  case "$cmd" in
    up) apply_external_tag_defaults; ensure_up "$INSTANCE" ;;
    test) run_tests "$@" ;;
    down) "$MUSTER" down --provider "$PROVIDER" --instance "$INSTANCE" ;;
    report) serve_report ;;
    *) die "usage: local.sh {up|test|down|report} [playwright args]" ;;
  esac
}

main "$@"
