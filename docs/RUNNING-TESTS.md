# Running E2E Tests

Everything you need to run the Playwright test suite for Rancher Dashboard, whether you're running natively or through Docker.

---

## 1. Before You Start

### What you need installed

- **Git** — check with `git --version`
- **Node.js 22+** — check with `node --version` ([download](https://nodejs.org/))
- **Yarn** — check with `yarn --version`. If you have Node 24+ with Corepack: `corepack enable`
  then `corepack prepare yarn@stable --activate`
- **Docker** — only if you want Docker mode (see sections 4–5). Needs at least 6 GB RAM allocated.

### Set up the project

```bash
# Clone the repo (HTTPS — no SSH key needed)
git clone https://github.com/izaac/dashboard-e2e-pw.git
cd dashboard-e2e-pw

# Install dependencies
yarn install

# Install the browser Playwright uses
npx playwright install chromium
```

### Configure your environment

```bash
# Copy the example env file
cp .env.example .env
```

Open `.env` in your editor and fill in at least these two:

```env
TEST_BASE_URL=https://your-rancher-instance/dashboard
TEST_PASSWORD=your-rancher-password
```

> **Important:** These tests run against a real, live Rancher instance. They click buttons, create
> resources, and verify real UI behavior. You need a running Rancher somewhere — either your own
> instance or one started via Docker (section 4).

---

## 2. Running Tests Locally (Native)

This assumes you have a Rancher instance running and your `.env` is configured.

### Run ALL tests

```bash
npx playwright test
```

### Run a single spec file

```bash
npx playwright test e2e/tests/pages/generic/login.spec.ts
```

### Run by test name

```bash
npx playwright test -g "Log in with valid"
```

This matches any test whose title contains that string — handy for running just one test.

### Run a whole folder

```bash
npx playwright test e2e/tests/navigation/
```

### Run headed (see the browser)

```bash
npx playwright test --headed
```

The browser window pops up so you can watch the test interact with the page. Great for debugging.

### Run in debug mode (step through)

```bash
npx playwright test --debug
```

Opens the Playwright Inspector — you can step through each action one at a time.

### Run with UI mode (interactive)

```bash
npx playwright test --ui
```

Opens a visual interface where you can pick tests, watch them run, see traces, and re-run on the fly.

### List tests without running them

```bash
npx playwright test --list
```

Shows every test that *would* run — useful for checking your filters before committing to a full run.

### Yarn shortcuts

The project has shortcut scripts in `package.json` so you don't have to type `npx playwright` every time:

```bash
yarn test              # all tests
yarn test:headed       # see the browser
yarn test:debug        # step through
yarn test:ui           # interactive UI mode
yarn test:list         # list without running
```

---

## 3. Filtering by Tags

Tags are how you pick which tests to run. The full suite has hundreds of tests and many of them
need specific infrastructure, so you'll almost always want to narrow things down.

### What are tags?

Tags are labels attached to tests in the source code. They look like this:

```ts
test('should display the home page', { tag: ['@adminUser', '@generic'] }, async () => {
  // ...
});
```

This test has two tags: `@adminUser` and `@generic`.

### How to use tags

Set the `GREP_TAGS` environment variable before running tests:

```bash
# Run only @generic tests (fast, good for your first try)
GREP_TAGS="@generic" npx playwright test

# Run admin user tests
GREP_TAGS="@adminUser" npx playwright test

# Run admin tests BUT exclude prime-only tests
GREP_TAGS="@adminUser+-@prime" npx playwright test

# Run admin tests, exclude prime AND noVai tests
GREP_TAGS="@adminUser+-@prime+-@noVai" npx playwright test

# Only explorer tests
GREP_TAGS="@explorer" npx playwright test

# Fleet tests only
GREP_TAGS="@fleet" npx playwright test
```

### Tag syntax explained

The `+` is the separator between filter tokens. `-@tag` means exclude.

| What you write          | What it does                           |
| ----------------------- | -------------------------------------- |
| `@tag`                  | Include tests that have this tag       |
| `+-@tag`                | Exclude tests that have this tag       |
| `@tag1+-@tag2`          | Include tag1, exclude tag2             |
| `@tag1+-@tag2+-@tag3`   | Include tag1, exclude tag2 and tag3    |

> **Note:** Tags are matched with word boundaries, so `@adminUser` won't accidentally match
> `@adminUserSetup`.

### Available tags

| Tag                | What it runs                                          |
| ------------------ | ----------------------------------------------------- |
| `@adminUser`       | Tests that need admin login                           |
| `@standardUser`    | Tests for non-admin users                             |
| `@generic`         | Basic UI tests (login, home, version) — fast          |
| `@globalSettings`  | Settings page tests                                   |
| `@manager`         | Cluster manager tests                                 |
| `@explorer`        | Cluster explorer tests (part 1)                       |
| `@explorer2`       | Cluster explorer tests (part 2)                       |
| `@fleet`           | Fleet management tests                                |
| `@navigation`      | Sidebar and header navigation                         |
| `@userMenu`        | User menu and preferences                             |
| `@usersAndAuths`   | Users and authentication tests                        |
| `@charts`          | Helm chart install/uninstall                          |
| `@provisioning`    | Cluster provisioning tests                            |
| `@prime`           | SUSE Prime edition only                               |
| `@noPrime`         | Non-Prime editions                                    |
| `@noVai`           | Tests requiring VAI disabled (ui-sql-cache off)       |
| `@needsInfra`      | Needs cloud creds or external infrastructure          |
| `@elemental`       | Elemental extension tests                             |
| `@accessibility`   | Accessibility (axe-core) scans                        |

---

## 4. Running Tests with Docker

Don't have a Rancher instance? Docker Compose can start one for you.

### Single Rancher instance

```bash
docker compose up
```

> **First time?** It takes 10–15 minutes. Docker needs to pull the Rancher image (~2 GB) and
> the Playwright container. Subsequent runs reuse cached images.

This starts two containers:

1. **Rancher** — boots with a bootstrap password, waits until healthy
2. **Tests** — runs the full suite against that Rancher instance

The test container waits for Rancher's healthcheck to pass before starting. You don't need to
do anything — just wait.

### Running specific tests via Docker

By default, if you don't provide any filters, Docker will run the **ENTIRE 500+ test suite**:

```bash
docker compose up
```

To avoid this, you can pass arguments to the test container by overriding the `command` or using environment variables.

**1. Run by Tags (The standard way)**
Use `GREP_TAGS` to run specific suites:

```bash
# Quick smoke test (~70 tests)
GREP_TAGS="@generic" docker compose up

# Run only navigation tests
GREP_TAGS="@navigation" docker compose up
```

**2. Run a specific spec file**
You can override the container's command to pass a specific file path. Use `run` instead of `up` to target just the tests container against a running Rancher:

```bash
# Make sure Rancher is already running in the background first
docker compose up rancher -d

# Run a specific file
docker compose run --rm tests npx playwright test e2e/tests/pages/generic/login.spec.ts
```

**3. Run a specific test by name**

```bash
docker compose run --rm tests npx playwright test -g "Log in with valid"
```

**4. Run a whole folder**

```bash
docker compose run --rm tests npx playwright test e2e/tests/navigation/
```

### Run with a specific Rancher version

```bash
RANCHER_IMAGE=docker.io/rancher/rancher:v2.14.0 docker compose up
```

### Override the password

```bash
RANCHER_PASSWORD=mysecretpassword docker compose up
```

> **Rancher 2.13+ requires passwords ≥12 characters.** The default `RANCHER_PASSWORD` is
> `password1234`. Do not use short passwords like `admin` — the setup page rejects them.

### Stop everything

```bash
docker compose down
```

### Sharded (2 Rancher instances, ~2× faster, ~10 GB RAM)

```bash
docker compose -f docker-compose.sharded.yml up
```

Results merge into `playwright-report/` when both shards finish.

### NixOS

NixOS kernels ship nftables only (no legacy iptables). Use the nftables overlay:

```bash
# Single
docker compose -f docker-compose.yml -f docker-compose.nix.yml up

# Sharded
docker compose -f docker-compose.sharded.yml -f docker-compose.sharded.nix.yml up
```

This builds a patched Rancher image that replaces iptables-legacy with iptables-nft.
Only needed on NixOS — other distros work with the stock image.

### Docker environment variables

| Variable           | Default                              | What it does                                          |
| ------------------ | ------------------------------------ | ----------------------------------------------------- |
| `RANCHER_IMAGE`    | `docker.io/rancher/rancher:head`     | Which Rancher Docker image to use                     |
| `RANCHER_PASSWORD` | `password1234`                       | Bootstrap + test password (≥12 chars)                 |
| `GREP_TAGS`        | *(empty)*                            | Tag filter (e.g. `@adminUser+-@prime`)                |
| `HOST_UID`         | `1000`                               | UID the tests container runs as (artifacts owned by host user) |
| `HOST_GID`         | `100`                                | GID the tests container runs as                       |

---

## 5. Docker Gotchas

### Source is bind-mounted — no rebuild on edit

The `tests` service bind-mounts the repo into `/app`. Editing specs, POs, or blueprints
takes effect on the next run with no `--build` step needed. Branch switches (e.g.
`git checkout release-2.14`) also reflect immediately.

The image still needs to be built once, and rebuilt when `package.json`/`yarn.lock` change
(so the container's installed `node_modules` pick up new deps):

```bash
docker compose build tests
```

An anonymous volume on `/app/node_modules` keeps the container's installed deps separate
from any host `node_modules` so the bind-mount doesn't shadow them.

### .dockerignore is critical

Without `.dockerignore`, the build context sends `node_modules/` (500 MB+) into the daemon,
bloating builds. The repo includes a `.dockerignore` that excludes `node_modules`,
`test-results`, `playwright-report`, `.git`, and local config files.

### Artifact ownership

The tests container runs as `${HOST_UID}:${HOST_GID}` (defaults `1000:100`) so files
written through the bind-mount — `test-results/`, `playwright-report/`, `.auth/` — are
owned by the host user, not root. If your host user differs from the defaults, set them
before running:

```bash
HOST_UID=$(id -u) HOST_GID=$(id -g) docker compose run --rm tests
```

Or persist them in `.env`.

---

## 6. Environment Variables

### Core

| Variable                    | Required          | Default                         | Description                                                                |
| --------------------------- | ----------------- | ------------------------------- | -------------------------------------------------------------------------- |
| `TEST_BASE_URL`             | Yes               | `https://localhost:8005`        | URL of your Rancher Dashboard (include `/dashboard` in path)               |
| `TEST_PASSWORD`             | Yes (native mode) | —                               | Password for logging into Rancher                                          |
| `TEST_USERNAME`             | No                | `admin`                         | Username for login                                                         |
| `CATTLE_BOOTSTRAP_PASSWORD` | Setup only        | —                               | Password for first-time Rancher setup (Docker Compose sets this for you)   |

### Filtering

| Variable    | Required | Default | What it does                                                         |
| ----------- | -------- | ------- | -------------------------------------------------------------------- |
| `GREP_TAGS` | No       | —       | Tag filter — see [section 3](#3-filtering-by-tags) for full syntax   |
| `TEST_SKIP` | No       | —       | Comma-separated test directories to skip (e.g., `setup,priority`)    |
| `TEST_ONLY` | No       | —       | Comma-separated test directories to run exclusively                  |

### Timeouts & Artifacts

| Variable              | Required | Default  | What it does                                  |
| --------------------- | -------- | -------- | --------------------------------------------- |
| `TEST_TIMEOUT`        | No       | `10000`  | Assertion and action timeout in milliseconds   |
| `TEST_NO_SCREENSHOTS` | No       | —        | Set to `true` to disable failure screenshots   |
| `TEST_NO_VIDEOS`      | No       | —        | Set to `true` to disable failure videos        |

### Cloud credentials (for `@needsInfra` tests)

These are only needed if you're running tests tagged `@needsInfra`. Most people can skip these entirely.

| Variable                    | What it's for       |
| --------------------------- | ------------------- |
| `AWS_ACCESS_KEY_ID`         | AWS provisioning    |
| `AWS_SECRET_ACCESS_KEY`     | AWS provisioning    |
| `AZURE_AKS_SUBSCRIPTION_ID` | Azure provisioning  |
| `AZURE_CLIENT_ID`           | Azure provisioning  |
| `AZURE_CLIENT_SECRET`       | Azure provisioning  |
| `GKE_SERVICE_ACCOUNT`       | GKE provisioning    |
| `CUSTOM_NODE_IP`            | Custom node tests   |
| `CUSTOM_NODE_KEY`           | Custom node tests   |

---

## 7. Reading Test Results

After tests finish, results end up in two places:

- **`test-results/`** — per-test artifacts: screenshots, videos, and traces (only for failed tests)
- **`playwright-report/`** — a nice HTML report with everything in one place

### Open the HTML report

```bash
npx playwright show-report
```

This starts a local web server and opens the report in your browser. You can see every test, click
into failures, and view traces right there.

### Quick failure summary

If tests failed and you want a fast overview before digging in:

```bash
yarn summarize-failures
cat test-results/FAILURE-SUMMARY.md
```

This classifies each failure (timeout, selector not found, API error, assertion mismatch, etc.)
and flags common issues like login page showing up or loading spinners still visible.

For a detailed walkthrough of how to investigate failures — understanding artifacts, diagnosing
failure types, and reproducing issues — see [Debugging Failures](DEBUGGING-FAILURES.md).

---

## 8. Troubleshooting

### "Rancher takes forever to start"

Rancher is a full Kubernetes distribution — it genuinely needs a few minutes to start. The
healthcheck retries up to 40 times (every 15 seconds) before giving up.

- Make sure Docker has at least 6 GB of RAM allocated
- Check `docker logs <rancher-container>` for errors
- On slower machines, Rancher might need more time — this is normal

### "Tests fail with login error"

- Double-check `TEST_PASSWORD` in your `.env` matches the actual Rancher password
- If using Docker mode, `RANCHER_PASSWORD` sets both the bootstrap and test password
- Make sure Rancher is fully healthy before running tests (`docker compose up rancher -d` and wait
  for the healthcheck to pass)

### "Port already in use"

The default Docker Compose maps port `8443` (HTTPS) and `8080` (HTTP) on your host. If something
else is using those ports:

- Stop the other service, or
- Edit the `ports:` section in `docker-compose.yml` (e.g., `9443:443`)

### "Chrome crashes"

This usually means the browser ran out of shared memory.

- In Docker: the Playwright base image handles this, but if you're hitting issues, add
  `--shm-size=2g` to your Docker run command
- On bare metal: close other browsers or memory-heavy apps

### "Tests work locally but fail in Docker"

- Check that `PLAYWRIGHT_CHROMIUM_PATH` is **not** set in your `.env` — that variable is for
  NixOS native runs only, and it breaks the Docker container
- Make sure your `.env` isn't overriding Docker Compose's environment variables

### "Certificate errors / TLS warnings"

The test suite sets `NODE_TLS_REJECT_UNAUTHORIZED=0` automatically because Rancher's default
certificate is self-signed. If you're still hitting TLS issues, check whether something in your
environment is overriding this.

### "Stale Docker images running old code"

See [Docker Gotchas](#5-docker-gotchas) — delete old images after editing source files.
