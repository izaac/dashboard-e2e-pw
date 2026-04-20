# Local E2E Testing Guide

Run the full Playwright E2E suite against a local Rancher instance — no remote servers, no cloud credentials required.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (Docker Desktop or Docker Engine with Compose)

That's it. Everything else runs inside containers.

## Quick Start

```bash
# Clone and enter the repo
git clone https://github.com/rancher/dashboard.git
cd dashboard/playwright

# Start Rancher + run all tests
docker compose up
```

This will:

1. Pull and start a Rancher container (takes 2–5 minutes to boot)
2. Wait for Rancher to be healthy (automatic via healthcheck)
3. Run the setup spec (bootstrap login, create standard user)
4. Run all admin user tests sequentially
5. Save results to `test-results/` and `playwright-report/`

## View Test Results

After the run completes:

```bash
# Open the HTML report in your browser
npx playwright show-report

# Or if you don't have Node.js installed locally:
# The report is at playwright-report/index.html — open it directly
```

## Run Specific Tests

### By Tag

Use `GREP_TAGS` to filter tests using Cypress-compatible syntax:

```bash
# Only lightweight generic tests (fast, good first run)
GREP_TAGS="@generic" docker compose up tests

# All admin tests except prime and noVai
GREP_TAGS="@adminUser+-@prime+-@noVai" docker compose up tests

# Admin tests excluding cloud/infra-dependent tests
GREP_TAGS="@adminUser+-@needsInfra" docker compose up tests

# Explorer tests only
GREP_TAGS="@explorer" docker compose up tests
```

**Tag syntax:**

| Syntax | Meaning |
|--------|---------|
| `@tag` | Include tests with this tag |
| `+-@tag` | Exclude tests with this tag |
| `@tag1+-@tag2` | Include tag1, exclude tag2 |

### By File or Test Name

Override the container command:

```bash
# Run a specific spec file
docker compose run tests npx playwright test e2e/tests/pages/generic/login.spec.ts

# Run a specific test by name
docker compose run tests npx playwright test -g "Log in with valid"
```

## Available Tags

| Tag | Description | Count |
|-----|-------------|-------|
| `@adminUser` | Admin user tests | ~240 |
| `@standardUser` | Standard user tests | ~50 |
| `@generic` | Generic UI tests (login, home, version) | ~17 |
| `@globalSettings` | Global settings tests | ~68 |
| `@manager` | Cluster manager tests | ~31 |
| `@explorer` | Cluster explorer tests | ~21 |
| `@explorer2` | Explorer v2 tests | ~21 |
| `@fleet` | Fleet management tests | ~11 |
| `@navigation` | Navigation tests | ~11 |
| `@userMenu` | User menu tests | ~18 |
| `@charts` | Helm charts tests | ~7 |
| `@extensions` | Extensions tests | ~3 |
| `@needsInfra` | Requires cloud credentials or external infrastructure | ~12 |
| `@prime` | SUSE Prime edition tests | ~7 |
| `@noVai` | Tests that disable VAI | ~33 |
| `@flaky` | Known flaky tests | ~6 |

## Use a Different Rancher Version

```bash
# Rancher 2.13
RANCHER_IMAGE=docker.io/rancher/rancher:v2.13.0 docker compose up

# Rancher 2.14
RANCHER_IMAGE=docker.io/rancher/rancher:v2.14.0 docker compose up

# Latest head build (default)
docker compose up
```

## Change the Bootstrap Password

```bash
RANCHER_PASSWORD=mysecret docker compose up
```

## Manage the Rancher Instance

```bash
# Start Rancher in the background (keep it running between test runs)
yarn local:up
# or: docker compose up rancher -d

# Run tests against the running Rancher
yarn local:test
# or: docker compose up tests

# Stop everything
yarn local:down
# or: docker compose down

# View report
yarn local:report
# or: npx playwright show-report
```

## Debugging Failed Tests

Every failed test produces three artifacts in `test-results/`:

- **Screenshot** — full page capture at the moment of failure
- **Video** — recording of the entire test
- **Trace** — step-by-step replay with DOM snapshots, network, console

To view a trace:

```bash
npx playwright show-trace test-results/<test-folder>/trace.zip
```

Or open the HTML report — traces are embedded and viewable in the browser.

## NixOS

NixOS kernels ship nftables only — the legacy `iptable_nat` / `iptable_filter` kernel modules are not compiled in. The stock Rancher image bundles `iptables-legacy` which crashes immediately on NixOS.

Use the NixOS compose override to build a patched Rancher image that swaps `iptables-legacy` for `iptables-nft` (translates iptables calls to the nftables kernel API):

```bash
# Single Rancher
docker compose -f docker-compose.yml -f docker-compose.nix.yml up

# Sharded (4 Ranchers)
docker compose -f docker-compose.sharded.yml -f docker-compose.nix.yml up

# With tag filtering
GREP_TAGS="@generic" docker compose -f docker-compose.yml -f docker-compose.nix.yml up tests
```

The override builds `Dockerfile.rancher-nix` which:
1. Copies the `nft` binary + shared libs from Debian into the SLES-based Rancher image
2. Copies `xtables-nft-multi` and all xtables extension `.so` files
3. Symlinks `iptables` → `xtables-nft-multi` so all iptables calls use the nft backend

This is **not needed** on distros that ship legacy iptables kernel modules (Ubuntu, Fedora, SLES, etc.).

## Troubleshooting

### Rancher takes too long to start

The healthcheck allows up to 10 minutes (`15s × 40 retries` after a `60s` start period). On slower machines, increase the retries:

```bash
# In docker-compose.yml, increase retries or start_period
```

### Tests fail with "login page not found"

Rancher might not be fully ready. Check its status:

```bash
docker compose logs rancher | tail -20
curl -sk https://localhost/dashboard/auth/login
```

### Port conflicts

If ports 80/443 are taken, change them in `docker-compose.yml`:

```yaml
ports:
  - "8080:80"
  - "8443:443"
```

Then set `TEST_BASE_URL=https://localhost:8443/dashboard` in the test environment.

### Want to run tests natively (without Docker)?

For developers who want `--ui` or `--debug` mode:

```bash
# Install dependencies
yarn install --frozen-lockfile
npx playwright install chromium

# Copy and configure .env
cp .env.example .env
# Edit .env with your Rancher URL and credentials

# Run tests
yarn test

# Interactive UI mode
yarn test:ui

# Debug mode (step through)
yarn test:debug
```

## Architecture

```
docker-compose.yml (single)
├── rancher service    → Rancher Dashboard (ports 80/443)
│   └── healthcheck    → polls /dashboard/auth/login
└── tests service      → Playwright container
    ├── depends_on     → waits for rancher healthy
    ├── setup project  → bootstrap login + create users
    └── chromium       → runs test specs sequentially
```

Tests run sequentially (`workers: 1`) against the single Rancher instance. The setup spec runs first automatically when `CATTLE_BOOTSTRAP_PASSWORD` is set.

## Parallel Execution (Sharded)

For faster runs, use 4 Rancher instances running test shards in parallel:

```bash
# Run all 4 shards (4 Ranchers + 4 test runners + merge)
docker compose -f docker-compose.sharded.yml up

# With tag filtering
GREP_TAGS="@adminUser+-@needsInfra" docker compose -f docker-compose.sharded.yml up

# Or use the yarn shortcut
yarn local:test:sharded
```

This will:

1. Boot 4 independent Rancher containers
2. Each shard bootstraps its own Rancher (setup spec runs per-shard)
3. Tests are split across 4 shards automatically by Playwright
4. After all shards finish, the `merge` service combines results into one HTML report
5. Report is written to `playwright-report/`

### Resource Requirements

Each Rancher instance needs ~4 GB RAM. For 4 shards:

| Shards | RAM (approx) | Wall Time |
|--------|-------------|-----------|
| 1 (default) | ~6 GB | 1× |
| 2 | ~10 GB | ~0.5× |
| 4 | ~18 GB | ~0.25× |

### Clean Up Sharded Volumes

```bash
# Stop and remove blob report volumes
yarn local:down:sharded
# or: docker compose -f docker-compose.sharded.yml down -v
```
