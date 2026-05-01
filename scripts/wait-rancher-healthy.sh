#!/bin/sh
# Poll the rancher docker container health, exit when healthy or after 240s.
#
# Usage:
#   sh scripts/wait-rancher-healthy.sh [container-name]
#
# Default container name: dashboard-e2e-pw-rancher-1
#
# Exit codes:
#   0 - container reached healthy state
#   1 - timeout reached without healthy state

set -eu

CONTAINER="${1:-dashboard-e2e-pw-rancher-1}"
MAX_ATTEMPTS=24
INTERVAL=10

n=0
while [ $n -lt $MAX_ATTEMPTS ]; do
  s=$(docker inspect "$CONTAINER" --format '{{.State.Health.Status}}' 2>/dev/null || echo "missing")
  if [ "$s" = "healthy" ]; then
    echo "rancher healthy after $((n * INTERVAL))s"
    exit 0
  fi
  sleep $INTERVAL
  n=$((n+1))
done

echo "timeout waiting for healthy (last status: $s)" >&2
exit 1
