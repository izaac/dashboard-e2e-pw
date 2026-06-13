#!/usr/bin/env bash
# Single-stack test run against a k3d-provisioned Rancher (PROVIDER=k3d flow).
# Provisions the `e2e` instance if its handoff file is missing, then runs the
# tests container attached to the k3d network. GREP_TAGS and cloud credential
# env vars pass through compose exactly like the docker flow.
#
# Usage:
#   GREP_TAGS='@generic' scripts/k3d-run.sh [extra playwright args...]

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

ENV_FILE=/tmp/k3d-rancher-e2e.env

if [ ! -f "$ENV_FILE" ]; then
  bash scripts/k3d-rancher.sh up e2e
fi

# shellcheck disable=SC1090
. "$ENV_FILE"
export TEST_BASE_URL

if [ "$#" -gt 0 ]; then
  docker compose -f docker-compose.yml -f docker-compose.k3d.yml run --rm tests \
    npx playwright test "$@" --reporter=line
else
  docker compose -f docker-compose.yml -f docker-compose.k3d.yml run --rm tests
fi
