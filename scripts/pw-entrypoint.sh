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
  for d in test-results playwright-report blob-report .auth; do
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
  # PW_EXTRA carries any extra `playwright test` args (the `up` path cannot
  # append them per-invocation the way `run` could).
  # shellcheck disable=SC2086
  npx playwright test --reporter=line "$@" ${PW_EXTRA:-} || status=$?
else
  "$@" || status=$?
fi

chown_back
exit "$status"
