# Docker Testing Guide (for Monko)

How to run Playwright specs inside Docker against a live Rancher instance.
This mirrors the ansible pipeline at `~/repos/qa-infra-automation/ansible/testing/dashboard-e2e-pw/`.

## Quick Reference

### 1. Build the image

```bash
cd ~/repos/dashboard-e2e-pw

docker build -t playwright-test:smoke \
  -f ~/repos/qa-infra-automation/ansible/testing/dashboard-e2e-pw/files/Dockerfile.ci \
  --build-arg NODE_VERSION=22 \
  --build-arg PLAYWRIGHT_VERSION=1.52.0 \
  --build-arg YARN_VERSION=1.22.22 \
  .
```

### 2. Copy playwright.sh into repo root (entrypoint needs it)

```bash
cp ~/repos/qa-infra-automation/ansible/testing/dashboard-e2e-pw/files/playwright.sh .
```

### 3. Run a single spec

```bash
docker run --rm -t --init \
  --shm-size=2g \
  --entrypoint bash \
  -e TEST_BASE_URL="https://<rancher-host>/dashboard" \
  -e TEST_PASSWORD="password1234" \
  -e TEST_USERNAME="admin" \
  -e TEST_SKIP="setup" \
  -e NODE_TLS_REJECT_UNAUTHORIZED="0" \
  -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  -e PLAYWRIGHT_CHROMIUM_PATH="" \
  -v "$(pwd):/e2e" \
  -w /e2e \
  playwright-test:smoke \
  -c "yarn install --frozen-lockfile --silent 2>&1 | tail -3 && npx playwright test e2e/tests/pages/generic/loading.spec.ts --reporter=line"
```

### 4. Run via entrypoint (full playwright.sh flow)

```bash
docker run --rm -t --init \
  --shm-size=2g \
  -e TEST_BASE_URL="https://<rancher-host>/dashboard" \
  -e TEST_PASSWORD="password1234" \
  -e TEST_USERNAME="admin" \
  -e TEST_SKIP="setup" \
  -e NODE_TLS_REJECT_UNAUTHORIZED="0" \
  -v "$(pwd):/e2e" \
  -w /e2e \
  playwright-test:smoke
```

### 5. Run with tag filter

Add `-e GREP_TAGS="@generic"` to only run specs matching that tag.

### 6. Cleanup

```bash
rm -f playwright.sh  # remove copied entrypoint
```

## Key gotchas

- **PLAYWRIGHT_CHROMIUM_PATH**: The repo `.env` has a NixOS-specific path. Must clear it in container (`-e PLAYWRIGHT_CHROMIUM_PATH=""`), or playwright.sh does it automatically via `unset`.
- **PLAYWRIGHT_BROWSERS_PATH**: Set to `/ms-playwright` so container uses its own Chrome, not host path.
- **Volume mount**: `-v "$(pwd):/e2e"` mounts repo into container. The `.env` file in repo root gets picked up — its values can conflict with `-e` flags. Container `-e` flags take precedence.
- **playwright.sh must be in repo root**: Dockerfile ENTRYPOINT expects `bash playwright.sh` relative to workdir `/e2e`. Copy it before running.
- **shm-size**: Chrome needs `--shm-size=2g` or it crashes on large pages.

## Current Rancher instance

```
Host: jnkui-da369fa0-rancher.qa.rancher.space
User: admin
Pass: password1234
```

## Credentials

```bash
source /home/izaac/.dashboard-e2e/config.sh
```

This exports AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and other creds needed for provisioning tests.

## Preferred: Use qa-infra run.sh

Always use the ansible pipeline wrapper. Manual `docker run` is for debugging only.

```bash
cd ~/repos/qa-infra-automation/ansible/testing/dashboard-e2e-pw
# Edit vars.yaml — set rancher_host, job_type: existing
source /home/izaac/.dashboard-e2e/config.sh
./run.sh setup test    # clone repo + run tests
./run.sh test          # re-run tests only
./run.sh destroy       # tear down infra (if provisioned)
```

## Dockerfile build args

| Arg | Default | Description |
|-----|---------|-------------|
| NODE_VERSION | 22 | Node.js major version (base image tag) |
| PLAYWRIGHT_VERSION | 1.52.0 | Must match @playwright/test in package.json |
| YARN_VERSION | 1.22.22 | Yarn classic version |
