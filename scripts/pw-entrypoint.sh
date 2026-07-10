#!/bin/sh
# Entrypoint for the containerised Playwright runner (Dockerfile.pw).
#
# Installs project dependencies into a named volume on first run, ensures the
# expected Chromium build is present, then runs the suite. Build artifacts are
# handed back to the invoking host user on exit so a rootful (Podman or Docker)
# container never leaves root-owned files in the bind-mounted checkout.

set -u

HOST_UID="${HOST_UID:-0}"
HOST_GID="${HOST_GID:-0}"

chown_back() {
  # The container runs as root so it can install deps and write into the named
  # node_modules volume; reassign only the host-visible outputs to the caller.
  for d in test-results playwright-report blob-report .auth snapshots; do
    if [ -e "/app/$d" ]; then
      chown -R "$HOST_UID:$HOST_GID" "/app/$d" 2>/dev/null || true
    fi
  done
}

if [ ! -d /app/node_modules/.bin ]; then
  echo "--- Installing project dependencies (first run) ---"
  yarn install --frozen-lockfile 2>/dev/null || yarn install
fi

# No-op when the bundled browser already matches the pinned Playwright version.
npx playwright install chromium >/dev/null 2>&1 || true

status=0
if [ "${1:-}" = "playwright-run" ]; then
  shift
  # PW_REPORTER selects the reporter (line for a single run, blob for shards so
  # the results can be merged afterwards). PW_EXTRA carries any extra
  # `playwright test` args (the `up` path cannot append them per-invocation the
  # way `run` could), e.g. --shard=1/2.
  # shellcheck disable=SC2086
  npx playwright test --reporter="${PW_REPORTER:-line}" "$@" ${PW_EXTRA:-} || status=$?
elif [ "${1:-}" = "merge-report" ]; then
  shift
  # Combine the per-shard blob reports into one HTML report. Routed through this
  # entrypoint (rather than a bare command) so chown_back hands the output back
  # to the host user.
  npx playwright merge-reports --reporter html "${1:-/app/blob-report}" || status=$?
else
  "$@" || status=$?
fi

chown_back
exit "$status"
