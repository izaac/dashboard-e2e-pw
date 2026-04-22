# Running E2E Tests

Everything you need to run the Playwright test suite for Rancher Dashboard, whether you're running natively or through Docker.

---

## 1. Before You Start

### What you need installed

- **Node.js 24+** — check with `node --version`
- **Yarn** — check with `yarn --version`
- **Docker** — only if you want Docker mode (see sections 4–6)

### Set up the project

```bash
# Clone the repo
git clone git@github.com:izaac/dashboard-e2e-pw.git
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

Tags are how you pick which tests to run. The full suite has hundreds of tests and many of them need specific infrastructure, so you'll almost always want to narrow things down.

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
| `@noVai`           | Tests that disable VAI (ui-sql-cache)                 |
| `@needsInfra`      | Needs cloud creds (AWS, Azure, GKE) — skip locally    |
| `@extensions`      | UI extensions                                         |
| `@flaky`           | Known unstable tests                                  |

### Common recipes

| What you want                   | Command                                                        |
| ------------------------------- | -------------------------------------------------------------- |
| Quick smoke test                | `GREP_TAGS="@generic" npx playwright test`                     |
| All admin tests, no cloud stuff | `GREP_TAGS="@adminUser+-@needsInfra" npx playwright test`      |
| Everything except flaky         | `GREP_TAGS="@adminUser+-@flaky" npx playwright test`           |
| Just explorer features          | `GREP_TAGS="@explorer" npx playwright test`                    |
| Global settings only            | `GREP_TAGS="@globalSettings" npx playwright test`              |
| Navigation + user menu          | Run them separately — tags don't combine with OR               |

> **Tip:** Start with `@generic` for your first run. It's fast (~17 tests) and verifies your setup
> is working before you tackle the bigger suites.

---

## 4. Running Tests with Docker (Single Rancher)

Don't have a Rancher instance? Docker Compose can start one for you.

### Quick start — everything in one command

```bash
docker compose up
```

That's it. This boots Rancher, waits for it to be healthy, then runs the tests.

> **First time?** It takes 10–15 minutes. Docker needs to pull the Rancher image (~2 GB) and
> Rancher itself takes 2–5 minutes to boot. Subsequent runs are much faster.

### Step by step (more control)

```bash
# Start Rancher in the background (keep it running between test runs)
docker compose up rancher -d
# or: yarn local:up

# Run tests against that Rancher
docker compose up tests
# or: yarn local:test

# Run with a tag filter
GREP_TAGS="@generic" docker compose up tests

# Stop everything
docker compose down
# or: yarn local:down

# View the HTML report
npx playwright show-report
# or: yarn local:report
```

### What happens behind the scenes

1. Docker pulls the Rancher image (first time only, ~2 GB)
2. Rancher boots up inside the container (2–5 minutes)
3. A healthcheck pings `https://localhost/dashboard/auth/login` every 15 seconds, up to 40 retries
4. Once healthy, the test container starts
5. The setup spec bootstraps Rancher (creates the admin password, performs first login)
6. Tests run sequentially against that Rancher instance
7. Results land in `test-results/` and `playwright-report/` on your machine

### Use a different Rancher version

```bash
# Rancher 2.14
RANCHER_IMAGE=docker.io/rancher/rancher:v2.14.0 docker compose up

# Rancher 2.13
RANCHER_IMAGE=docker.io/rancher/rancher:v2.13.0 docker compose up

# Latest development build (this is the default)
docker compose up
```

### Change the password

```bash
RANCHER_PASSWORD=mysecretpassword docker compose up
```

This sets both the bootstrap password and the test login password.

---

## 5. Running Tests with Docker (Sharded — 4 Ranchers)

Instead of running all tests against one Rancher, you can spin up four Rancher instances and split the work across them. This cuts the wall-clock time roughly by four.

```bash
# Run all 4 shards
docker compose -f docker-compose.sharded.yml up

# With tag filter
GREP_TAGS="@adminUser+-@needsInfra" docker compose -f docker-compose.sharded.yml up

# Yarn shortcut
yarn local:test:sharded

# Stop and clean up volumes
docker compose -f docker-compose.sharded.yml down -v
# or: yarn local:down:sharded
```

### What happens

1. Four Rancher containers (`rancher-1` through `rancher-4`) boot in parallel
2. Four test runners each get one quarter of the tests (`--shard=1/4`, `--shard=2/4`, etc.)
3. Each shard bootstraps its own Rancher independently
4. When all four finish, a merge service combines the reports into one
5. Final report lands in `playwright-report/`

### Resource requirements

| Setup           | RAM needed | Relative speed |
| --------------- | ---------- | -------------- |
| Single Rancher  | ~6 GB      | 1×             |
| 2 Ranchers      | ~10 GB     | ~2× faster     |
| 4 Ranchers      | ~18 GB     | ~4× faster     |

> **Heads up:** Four Rancher instances are hungry. Make sure Docker has enough memory allocated
> (check Docker Desktop → Settings → Resources if you're on Mac/Windows).

---

## 6. Environment Variables Reference

All the environment variables the test suite understands, in one place.

### Core (most people need these)

| Variable                   | Required           | Default                            | What it does                                                                |
| -------------------------- | ------------------ | ---------------------------------- | --------------------------------------------------------------------------- |
| `TEST_BASE_URL`            | Yes                | `https://localhost:8005`           | URL of your Rancher Dashboard (include `/dashboard` in path)                |
| `TEST_PASSWORD`            | Yes (native mode)  | —                                  | Password for logging into Rancher                                           |
| `TEST_USERNAME`            | No                 | `admin`                            | Username for login                                                          |
| `CATTLE_BOOTSTRAP_PASSWORD`| Setup only         | —                                  | Password for first-time Rancher setup (Docker Compose sets this for you)    |

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

### Docker mode

| Variable           | Required | Default                              | What it does                                          |
| ------------------ | -------- | ------------------------------------ | ----------------------------------------------------- |
| `RANCHER_IMAGE`    | No       | `docker.io/rancher/rancher:head`     | Which Rancher Docker image to use                     |
| `RANCHER_PASSWORD`  | No       | `password1234`                       | Bootstrap + test password (used by Docker Compose)    |

### Cloud credentials (for `@needsInfra` tests)

These are only needed if you're running tests tagged `@needsInfra`. Most people can skip these entirely.

| Variable                    | What it's for       |
| --------------------------- | ------------------- |
| `AWS_ACCESS_KEY_ID`         | AWS provisioning    |
| `AWS_SECRET_ACCESS_KEY`     | AWS provisioning    |
| `AZURE_AKS_SUBSCRIPTION_ID`| Azure provisioning  |
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

### Viewing a trace

Traces are step-by-step recordings of what happened during a failed test — every click, every network request, every DOM snapshot. They're the single best tool for figuring out what went wrong.

```bash
npx playwright show-trace test-results/<test-folder>/trace.zip
```

Or just open the HTML report — traces are clickable right there, no separate command needed.

---

## 8. Troubleshooting

### "Rancher takes forever to start"

Rancher is a full Kubernetes distribution — it genuinely needs a few minutes to start. The healthcheck retries up to 40 times (every 15 seconds) before giving up.

**Things to try:**
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

The test suite sets `NODE_TLS_REJECT_UNAUTHORIZED=0` automatically because Rancher's default certificate is self-signed. If you're still hitting TLS issues, check whether something in your environment is overriding this.
