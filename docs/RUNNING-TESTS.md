# Running E2E Tests

Everything you need to run the Playwright test suite for Rancher Dashboard, whether you're running natively against your own Rancher or through the containerized muster runner.

---

## 1. Before You Start

### What you need installed

- **Git**: check with `git --version`
- **Node.js 22+**: check with `node --version` ([download](https://nodejs.org/))
- **Yarn**: check with `yarn --version`. If you have Node 24+ with Corepack: `corepack enable`
  then `corepack prepare yarn@stable --activate`
- **Docker or Podman**, only if you want the containerized muster runner (see
  sections 4 to 5). Needs at least 6 GB RAM available for the cluster, plus the
  muster provisioning tools (`k3d`, `kubectl`, `helm`).

### Set up the project

```bash
# Clone the repo (HTTPS, no SSH key needed)
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
> resources, and verify real UI behavior. You need a running Rancher somewhere, either your own
> instance or one provisioned by muster (section 4).

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

This matches any test whose title contains that string, which is handy for running just one test.

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

Opens the Playwright Inspector, so you can step through each action one at a time.

### Run with UI mode (interactive)

```bash
npx playwright test --ui
```

Opens a visual interface where you can pick tests, watch them run, see traces, and re-run on the fly.

### List tests without running them

```bash
npx playwright test --list
```

Shows every test that *would* run. Useful for checking your filters before committing to a full run.

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
| `@generic`         | Basic UI tests (login, home, version), fast           |
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
| `@visual`          | Visual snapshot tests, excluded from default GREP     |

---

## 4. Running Tests with muster (containerized)

Don't have a Rancher instance? [muster](https://github.com/izaac/muster) can
provision one for you, and the suite runs inside a container against it. The
host needs a Docker or Podman daemon and the muster provisioning tools (`k3d`,
`kubectl`, `helm`). It does not need Node, Yarn, or a browser, because all of
that lives in the test container.

muster is the productized provisioner that grew out of this repo's old
`k3d-rancher.sh`. It boots a real PROD Rancher on k3d (k3s in a container) using
the official Helm chart, exactly the way CI does. The wrappers in `scripts/`
(`local.sh` and `local-sharded.sh`) drive muster and the container runner, and
the `yarn local:*` scripts are thin aliases over them.

### Point the runner at muster

The wrappers look for muster in this order: the `MUSTER` env var, then the
`./muster` symlink in the repo root, then `muster` on your `PATH`. The simplest
setup is to clone muster next to this repo and symlink it:

```bash
git clone https://github.com/izaac/muster.git ../muster
ln -s ../muster muster
```

### Single Rancher instance

```bash
# Provision Rancher, then run the suite (defaults to the full suite)
yarn local:test
```

> **First time?** It takes roughly 10 to 15 minutes. muster pulls the Rancher
> image and the wrapper builds the test container. Later runs reuse both, and an
> already-provisioned instance is reused instead of reprovisioned.

`yarn local:test` provisions if needed and then runs Playwright in a container
against that Rancher. To keep the cluster up across many runs, provision once
and run repeatedly:

```bash
yarn local:up      # provision Rancher and leave it running
yarn local:test    # run against the existing cluster (reused, not rebuilt)
yarn local:test    # again, instantly
yarn local:down    # tear the cluster down
```

### Running specific tests

With no filter, the runner executes the entire suite. Narrow it down with tags
or by passing Playwright arguments through after `--`.

**1. By tag (the standard way)**

```bash
# Quick smoke test (~70 tests)
GREP_TAGS="@generic" yarn local:test

# Navigation only
GREP_TAGS="@navigation" yarn local:test
```

**2. A specific spec file**

Arguments after `--` are forwarded straight to `playwright test`:

```bash
yarn local:test -- e2e/tests/pages/generic/login.spec.ts
```

**3. A specific test by name**

```bash
yarn local:test -- -g "Log in with valid"
```

**4. A whole folder**

```bash
yarn local:test -- e2e/tests/navigation/
```

### Run against a specific Rancher version or channel

The wrapper forwards `VERSION` and `REPO` to `muster up` (`--version` and
`--repo`), so you can pin the image tag or switch chart channel:

```bash
# A released line instead of head
VERSION=2.14 yarn local:up

# A specific channel (see `muster up --help` for channel names)
REPO=rancher-com-alpha VERSION=head yarn local:up
```

### Reprovision from scratch

An existing instance is reused by default. Set `FRESH` to tear it down and
provision a clean one before running:

```bash
FRESH=true yarn local:test
```

### Stop everything

```bash
yarn local:down
```

### Serve the last HTML report

```bash
yarn local:report
# Opens the report from a container on http://localhost:9323 (set REPORT_PORT to change)
```

### Re-running `e2e/tests/setup/rancher-setup.spec.ts` against a fresh Rancher

`rancher-setup.spec.ts` is the bootstrap shim. It covers four backend states
detected at runtime by `detectBootstrapState`:

| State | Trigger | Tests that run |
|---|---|---|
| `needs-configure` | `CATTLE_BOOTSTRAP_PASSWORD` env set, configure not done | `Login & Configure`, `Create standard user` |
| `bootstrapped` | admin user already exists | `Create standard user` (skips if `standard_user` exists) |
| `needs-login` | fresh Rancher, no env-supplied bootstrap password | `Requires initial setup`, `Confirm correct number of settings requests made` |
| `fully-configured` | admin + standard_user already exist | all skip |

To re-validate the spec from a clean slate, reprovision and target just that
spec:

```bash
FRESH=true yarn local:test -- e2e/tests/setup/rancher-setup.spec.ts
```

Recent Rancher (v2.15+) auto-creates the admin user even on a fresh cluster, so
the state machine usually collapses into `bootstrapped` once the user logs in
once. The `needs-login` test paths are kept for older Rancher images.

### Sharded (one Rancher per shard, faster wall-clock)

Sharding fans the suite out across several Rancher instances. Each shard gets
its own muster-provisioned Rancher (`e2e-1`, `e2e-2`, and so on, each on its own
k3d network) and runs in its own container with `--shard=i/N`. The per-shard
blob reports merge into a single HTML report at the end.

```bash
# Two shards by default
yarn local:test:sharded

# More shards
SHARDS=4 yarn local:test:sharded

# Provision and tear down the shard fleet explicitly
yarn local:up:sharded
yarn local:down:sharded
```

> Each shard runs its own Rancher because sharding against one shared instance
> would let parallel shards mutate the same global state (settings, branding,
> users). CI typically uses a single shared Rancher per tag instead, so this
> wrapper exists mainly for local fan-out.

### Prime mode

Prime mode (SUSE branding, `RancherPrime=true`) is required for `@prime`-tagged
tests and to generate or verify visual baselines under `snapshots/.../prime/`.
Select a Prime channel through muster when you provision:

```bash
REPO=rancher-prime VERSION=head yarn local:up
GREP_TAGS="@prime" yarn local:test
```

The `isPrime` test fixture reads `RancherPrime` from the API and routes visual
snapshots to the matching `prime/` or `community/` subdirectory automatically.
See `muster up --help` for the exact Prime channel name available to you.

### Runner environment variables

These apply to `scripts/local.sh` (the `yarn local:*` single-instance scripts):

| Variable      | Default            | What it does                                                        |
| ------------- | ------------------ | ------------------------------------------------------------------ |
| `MUSTER`      | `./muster` symlink | Path to the muster executable                                      |
| `PROVIDER`    | `k3d`              | muster substrate provider (`k3d`, `docker`, `existing`)            |
| `INSTANCE`    | `e2e`              | muster instance name                                               |
| `GREP_TAGS`   | *(empty)*          | Playwright tag filter (e.g. `@adminUser+-@prime`)                  |
| `VERSION`     | *(muster default)* | Rancher image tag, forwarded to `muster up --version`             |
| `REPO`        | *(muster default)* | Rancher chart channel, forwarded to `muster up --repo`            |
| `FRESH`       | *(unset)*          | Tear down and reprovision the instance before running             |
| `EXTERNAL`    | *(unset)*          | Provision behind a public tunnel for provisioning tests (below)   |
| `REPORT_PORT` | `9323`             | Host port used by `yarn local:report`                             |
| `DOCKER_HOST` | *(auto)*           | Honoured as-is; on a Podman host the rootful socket is auto-picked |

The sharded wrapper (`scripts/local-sharded.sh`) adds `SHARDS` (default `2`) and
`INSTANCE_PREFIX` (default `e2e`); shard `i` is `<prefix>-i`.

> On a Podman host the runner selects the rootful socket automatically. Rancher's
> jailer needs real device-node creation, which a rootless container cannot do,
> so the substrate has to be rootful. This also matches CI, which runs on rootful
> Docker.

### Reproducing CI's branch-matched dashboard

The PR workflow (`.github/workflows/e2e-k3d-pr.yml`) does not test the image's
CDN dashboard. It builds the `rancher/dashboard` ref mapped to the target branch
in `branches-metadata.json`, then provisions Rancher with that dist mounted over
the pod's UI, so PRs validate against the matching dashboard source.

`scripts/k3d-e2e.sh` builds that branch-matched dist locally, the same way CI's
build-dashboard job does:

```bash
scripts/k3d-e2e.sh resolve   # print the resolved image/chart/dashboard targets
scripts/k3d-e2e.sh build     # clone the matched ref and build its dist into dashboard-src/
```

The dist is built inside the `node:<.nvmrc>` container (not on the host), running
as your uid so the output is not root-owned. To run the suite against it, hand
the built dist to muster through the wrapper:

```bash
DASHBOARD_DIST="$PWD/dashboard-src/dist" yarn local:up
yarn local:test
```

`ensure_up` forwards `DASHBOARD_DIST` to `muster up --dashboard-dist`, which
mounts the locally built dashboard over the pod's UI. With no `DASHBOARD_DIST`,
the suite tests the image's CDN-resolved dashboard.

### External access for provisioning tests

Cluster-provisioning specs (`@provisioning`, plus the AWS/Azure/GKE/custom-node
guarded tests) spin up a real downstream node on a cloud provider. That node
lives on the public internet and must register back to your Rancher, but the
default k3d URL is only routable inside the container network. `EXTERNAL=true`
solves this: muster starts a
[cloudflared](https://github.com/cloudflare/cloudflared) quick tunnel, installs
Rancher on the allocated public host, pins `server-url` to it, and sets
`agent-tls-mode=system-store` so the node agent trusts Cloudflare's edge cert.

```bash
# Provision behind a tunnel and run the provisioning specs against it.
# EXTERNAL auto-defaults GREP_TAGS to @provisioning.
EXTERNAL=true \
AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
yarn local:test
```

Notes:

- `EXTERNAL=true` defaults `GREP_TAGS` to `@provisioning`. The repo `.env`
  otherwise filters `@needsInfra` and `@provisioning` out, so internal runs skip
  them. Pass your own `GREP_TAGS` to override.
- Internal runs (no `EXTERNAL`) provision without a tunnel and run the normal
  tagged suite. This is the same tag contract CI uses: external only when
  provisioning or infra is in play, internal otherwise.
- `cloudflared` is fetched by muster on demand, so there is no manual install and
  no `SSL_CERT_FILE` exports.
- The tunnel host is random per run and dies when the tunnel process stops, so
  `yarn local:down` always cleans it up. Sharded provisioning legs each get their
  own host with no collision.
- This is **not wired into PR checks**, because it needs real cloud credentials
  and incurs cloud spend. Run it manually when you have creds.
- Set the AWS machine-pool **region** explicitly on cluster create. It defaults
  separately from the cloud credential.

> Want to run the legacy upstream Cypress suite against the same kind of cluster?
> muster ships a Cypress runner under `examples/cypress-upstream/` that uses the
> official `cypress/included` image and muster's Cypress handoff, so no host Node
> or Cypress install is needed. See that example's README.

---

## 5. Runner Gotchas

The container runner is defined in `docker-compose.pw.yml` (built from
`Dockerfile.pw`) and driven by `scripts/local.sh`. A few things worth knowing.

### Source is bind-mounted, no rebuild on edit

The `tests` service bind-mounts the checkout into `/app`. Editing specs, POs, or
blueprints takes effect on the next `yarn local:test` with no rebuild needed.
Branch switches (e.g. `git checkout release-2.14`) also reflect immediately.

The image is built once from `Dockerfile.pw` (the `--build` flag handles this
automatically) and only needs rebuilding when `package.json` or `yarn.lock`
change, so the container's installed `node_modules` pick up new deps. A named
volume (`pw-node-modules`) on `/app/node_modules` keeps the container's deps
separate from any host `node_modules`, so the bind-mount does not shadow them
and a host install is neither required nor clobbered.

### dashboard-src is masked

CI clones `rancher/dashboard` into `dashboard-src/` to build the UI dist. A bind
mount ignores `.dockerignore`, so the compose file masks that directory with an
anonymous volume to keep its bundled Cypress specs out of Playwright discovery.
The Playwright config also guards this via `testIgnore: 'dashboard-src/**'`.

### Artifact ownership

The tests container runs as `${HOST_UID}:${HOST_GID}`, which `scripts/local.sh`
sets to your `id -u` / `id -g` automatically. Files written through the
bind-mount (`test-results/`, `playwright-report/`, `blob-report/`) are therefore
owned by the host user, not root. The report and merge steps run through the
same entrypoint so their output is chowned back to you as well.

---

## 6. Environment Variables

### Core

| Variable                    | Required          | Default                         | Description                                                                |
| --------------------------- | ----------------- | ------------------------------- | -------------------------------------------------------------------------- |
| `TEST_BASE_URL`             | Yes               | `https://localhost:8005`        | URL of your Rancher Dashboard (include `/dashboard` in path)               |
| `TEST_PASSWORD`             | Yes (native mode) | —                               | Password for logging into Rancher                                          |
| `TEST_USERNAME`             | No                | `admin`                         | Username for login                                                         |
| `CATTLE_BOOTSTRAP_PASSWORD` | Setup only        | —                               | Password for first-time Rancher setup (the muster runner sets this for you) |

### Filtering

| Variable    | Required | Default | What it does                                                         |
| ----------- | -------- | ------- | -------------------------------------------------------------------- |
| `GREP_TAGS` | No       | —       | Tag filter; see [section 3](#3-filtering-by-tags) for full syntax    |
| `TEST_SKIP` | No       | —       | Comma-separated test directories to skip (e.g., `setup,priority`)    |
| `TEST_ONLY` | No       | —       | Comma-separated test directories to run exclusively                  |

### Timeouts & Artifacts

| Variable              | Required | Default  | What it does                                  |
| --------------------- | -------- | -------- | --------------------------------------------- |
| `TEST_TIMEOUT`        | No       | `10000`  | Assertion and action timeout in milliseconds   |
| `TEST_NO_SCREENSHOTS` | No       | —        | Set to `true` to disable failure screenshots   |
| `TEST_NO_VIDEOS`      | No       | —        | Set to `true` to disable failure videos        |

### Cloud credentials (for `@needsInfra` tests)

These are only needed if you're running tests tagged `@needsInfra` or
`@provisioning`. Most people can skip these entirely. Pair them with
`EXTERNAL=true` (see [the k3d external-access section](#external-access-for-provisioning-tests))
so the downstream node can reach Rancher.

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
| `CUSTOM_NODE_USER`          | Custom node SSH user (default `ec2-user`)                            |
| `EXTERNAL`                  | `true` => `up` tunnels Rancher to a public host so nodes can register |
| `EXTERNAL_HOSTNAME`         | Public host to install on instead of the auto quick tunnel           |

---

## 7. Visual snapshot tests

Visual tests use Playwright's built-in `expect(page).toHaveScreenshot()` and are
tagged `@visual`. They are **excluded from the default `GREP_TAGS`** so normal runs
don't pay the pixel-diff cost.

Baselines live under `snapshots/` at the repo root, keyed by Prime vs Community
edition (e.g. `snapshots/<spec-path>/community/<name>.png`).

> **For the rationale (why no Percy) and the conventions** (Prime/Community keying,
> theme pinning, content waits), see [UPSTREAM-DIVERGENCES.md §6](./UPSTREAM-DIVERGENCES.md#6-visual-snapshots-percy--playwright).
>
> **For how to add a new visual test**, see the "Visual snapshots" section in
> [WRITING-TESTS.md](./WRITING-TESTS.md).

### Run them

```bash
GREP_TAGS="@visual+-@prime+-@noVai+-@needsInfra" yarn local:test
```

### Update baselines

After an intentional UI change, regenerate from inside the container:

```bash
GREP_TAGS="@visual+-@prime+-@noVai+-@needsInfra" \
  yarn local:test -- --update-snapshots
```

Review the diff and commit the updated PNGs. Baselines are tied to the Rancher
image, so bumping the Rancher `VERSION` usually requires a regen.

### Tolerance

Global default in `playwright.config.ts`: `maxDiffPixelRatio: 0.01` (1%). Prefer
masking volatile content (e.g. via `SortableTablePo.ageColumn()`) over raising the
global ratio.

---

## 8. Reading Test Results

After tests finish, results end up in two places:

- **`test-results/`** holds per-test artifacts: screenshots, videos, and traces (only for failed tests)
- **`playwright-report/`** is a nice HTML report with everything in one place

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

For a detailed walkthrough of how to investigate failures (understanding artifacts, diagnosing
failure types, and reproducing issues), see [Debugging Failures](DEBUGGING-FAILURES.md).

---

## 9. Troubleshooting

### "Rancher takes forever to start"

Rancher is a full Kubernetes distribution, so it genuinely needs a few minutes
to start. muster runs its own readiness gates and only hands off once the API
and dashboard respond.

- Make sure the host has at least 6 GB of RAM available for the cluster
- Inspect the cluster with `KUBECONFIG=local.yaml kubectl get pods -A` or check
  the muster output for the failing gate
- On slower machines, Rancher might need more time. This is normal.

### "Tests fail with login error"

- Double-check `TEST_PASSWORD` in your `.env` matches the actual Rancher password
- When using the muster runner, the bootstrap and test passwords come from
  `muster env`, so a stale `.env` override can cause a mismatch
- Make sure Rancher is fully provisioned before running tests. `yarn local:up`
  blocks until muster's readiness gates pass.

### "Port already in use"

The container runner does not bind privileged host ports, because the tests
reach Rancher over the k3d container network. If `yarn local:report` cannot bind
its port, something else is using `9323`:

- Stop the other service, or
- Set `REPORT_PORT` to a free port (e.g. `REPORT_PORT=9999 yarn local:report`)

### "Chrome crashes"

This usually means the browser ran out of shared memory.

- In the container: `docker-compose.pw.yml` already sets `shm_size: 2g`, so this
  should be handled. If you still hit it, raise that value.
- On bare metal: close other browsers or memory-heavy apps

### "Tests work locally but fail in the container"

- Check that `PLAYWRIGHT_CHROMIUM_PATH` is **not** set in your `.env`, because
  that variable is for NixOS native runs only and it breaks the container
- Make sure your `.env` is not overriding the environment that
  `scripts/local.sh` sources from `muster env`

### "Certificate errors / TLS warnings"

The test suite sets `NODE_TLS_REJECT_UNAUTHORIZED=0` automatically because
Rancher's default certificate is self-signed. If you are still hitting TLS
issues, check whether something in your environment is overriding this.

### "Stale image running old code"

See [Runner Gotchas](#5-runner-gotchas). The source is bind-mounted, so spec
edits apply on the next run, but a dependency change needs a rebuild. The
`--build` flag in `scripts/local.sh` handles that; if in doubt, remove the
`dashboard-e2e-pw-tests:local` image and let the next run rebuild it.
