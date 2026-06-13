#!/bin/sh
# Tear down ALL compose stacks (default, sharded, nix variants) and remove
# every named volume they declare. Safe to run even if a stack is not up.
#
# Usage:
#   sh scripts/nuke.sh

set -eu

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "--- Tearing down all compose stacks ---"

docker compose -f docker-compose.yml down -v 2>/dev/null || true
docker compose -f docker-compose.sharded.yml down -v 2>/dev/null || true

# Nix overlay variants share containers with the base files but declare no
# extra volumes; include them just to ensure any orphaned containers are removed.
docker compose -f docker-compose.yml -f docker-compose.nix.yml down -v 2>/dev/null || true
docker compose -f docker-compose.sharded.yml -f docker-compose.sharded.nix.yml down -v 2>/dev/null || true

echo "--- k3d provider cleanup (when k3d is installed) ---"
if command -v k3d >/dev/null 2>&1; then
  docker compose -f docker-compose.yml -f docker-compose.k3d.yml down -v 2>/dev/null || true
  docker compose -f docker-compose.sharded.yml -f docker-compose.sharded.k3d.yml down -v 2>/dev/null || true
  for c in $(k3d cluster list --no-headers 2>/dev/null | awk '{print $1}' | grep '^e2e' || true); do
    k3d cluster delete "$c" || true
  done
fi
rm -f /tmp/k3d-rancher-*.env

echo "--- Pruning any orphaned containers still holding volumes ---"
docker container prune -f 2>/dev/null || true

echo "--- Removing named project volumes (belt-and-suspenders) ---"
for vol in rancher-data rancher-1-data rancher-2-data blob-reports; do
  docker volume rm "dashboard-e2e-pw_${vol}" 2>/dev/null && echo "  removed dashboard-e2e-pw_${vol}" || true
done

echo "Done. All stacks and volumes removed."
