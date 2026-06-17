#!/usr/bin/env bash
# Single-stack test run against a k3d-provisioned Rancher (PROVIDER=k3d flow)
# using the upstream Cypress suite.
# Provisions the `e2e` instance if its handoff file is missing, then runs the
# cypress container attached to the k3d network. GREP_TAGS and cloud credential
# env vars pass through compose exactly like the docker flow.
#
# Usage:
#   GREP_TAGS='@generic' scripts/k3d-cypress-run.sh [extra yarn args...]
#
# Provisioning specs (downstream node must register back to Rancher) need a
# publicly reachable server-url and real cloud credentials. Export the creds
# and set EXTERNAL=true so the auto-provision below installs Rancher behind a
# cloudflared quick tunnel:
#   EXTERNAL=true \
#   AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
#   scripts/k3d-cypress-run.sh
# EXTERNAL=true also defaults GREP_TAGS to '@provisioning' (the repo .env
# otherwise filters @needsInfra/@provisioning out); pass your own GREP_TAGS to
# override. Credential vars forwarded to the tests container (see
# docker-compose.k3d.yml):
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
#   AZURE_AKS_SUBSCRIPTION_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET,
#   CUSTOM_NODE_IP, CUSTOM_NODE_KEY, CUSTOM_NODE_USER, GKE_SERVICE_ACCOUNT.
# Guarded tests test.skip() when their credential is absent.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# True for 1/true/yes/on (case-insensitive).
is_true() {
  case "$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')" in
    1 | true | yes | on) return 0 ;;
    *) return 1 ;;
  esac
}

if is_true "${EXTERNAL:-}" && [ -z "${GREP_TAGS:-}" ]; then
  GREP_TAGS='@provisioning'
  export GREP_TAGS
  echo "--- EXTERNAL: defaulting GREP_TAGS=@provisioning ---"
fi

# Ensure cluster is up
if [ ! -f "/tmp/k3d-rancher-e2e.env" ]; then
  bash scripts/k3d-rancher.sh up e2e
fi

# Generate Cypress-specific handoff
ENV_FILE="/tmp/muster-cypress-e2e.env"
./muster/muster env --instance e2e --out cypress > "$ENV_FILE"

# shellcheck disable=SC1090
. "$ENV_FILE"
export TEST_BASE_URL API TEST_USERNAME CATTLE_BOOTSTRAP_PASSWORD TEST_PASSWORD

if [ "$#" -gt 0 ]; then
  docker compose -f docker-compose.yml -f docker-compose.k3d.yml run --rm cypress "$@"
else
  docker compose -f docker-compose.yml -f docker-compose.k3d.yml run --rm cypress
fi
