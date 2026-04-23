# Rancher Dashboard E2E — Playwright

Playwright E2E test suite for [Rancher Dashboard](https://github.com/rancher/dashboard). Tests run against a live Rancher instance — clicking buttons, creating resources, and verifying real UI behavior.

## Get Running

### Fastest path: Docker (no Node required)

```bash
# Boots Rancher + runs a quick smoke test (~17 tests)
GREP_TAGS="@generic" docker compose up
```

> First run pulls ~2 GB and takes 10–15 minutes. Requires Docker with at least 6 GB RAM and free ports `8443`/`8080`.

```bash
# Run the full admin suite
docker compose up

# Run with a specific Rancher version
RANCHER_IMAGE=docker.io/rancher/rancher:v2.14.0 docker compose up

# Sharded (2 Rancher instances, ~2× faster, needs ~10 GB RAM)
docker compose -f docker-compose.sharded.yml up

# Stop everything
docker compose down
```

### Native setup (your own Rancher instance)

```bash
# Prerequisites: Node 24+, Yarn
git clone https://github.com/izaac/dashboard-e2e-pw.git
cd dashboard-e2e-pw
yarn install
npx playwright install chromium

# Configure
cp .env.example .env
# Edit .env — set TEST_BASE_URL and TEST_PASSWORD for your Rancher instance

# Run all tests
npx playwright test

# Run a single spec
npx playwright test e2e/tests/pages/generic/login.spec.ts

# Run by test name
npx playwright test -g "Log in with valid"
```

> **Tip:** Start with `GREP_TAGS="@generic" npx playwright test` for a fast smoke test before running the full suite.

## Guides

| Guide | What it covers |
|---|---|
| **[Running Tests](docs/RUNNING-TESTS.md)** | Setup, execution modes, Docker, sharding, tag filtering, environment variables |
| **[Debugging Failures](docs/DEBUGGING-FAILURES.md)** | Investigating failures — artifacts, traces, failure types, reproduction |
| **[Writing Tests](docs/WRITING-TESTS.md)** | Page Objects, fixtures, golden rules, blueprints, step-by-step walkthrough |
| **[Parallelism](docs/PARALLELISM.md)** | Which specs can run in parallel vs serial |
| **[Contributing](CONTRIBUTING.md)** | How to contribute — workflow, rules, conventions |

## Architecture

```
e2e/
  tests/          # Spec files — import POs and fixtures, no raw selectors
  po/             # Page Objects (mirrors upstream Cypress structure)
  blueprints/     # Test data fixtures (factory functions)
support/
  fixtures/       # Playwright fixtures (login, rancherApi, envMeta)
  utils/          # Shared utilities
scripts/          # Developer tooling (gap-map, po-index, po-diff)
docs/             # Guides and reference
```

## Test Design

Every test is written to work reliably against a shared Rancher instance:

- **Atomic** — sets up what it needs, does its thing, cleans up. No test depends on another.
- **Idempotent** — run once or fifty times, pass or fail midway — works next time.
- **Web-first assertions** — `await expect(loc).toBeVisible()` auto-retries instead of reading the DOM once.
- **No raw selectors in specs** — every selector lives in a Page Object.
- **Explicit cleanup** — every resource created gets cleaned up in `try/finally`.

This isn't a find-and-replace from Cypress. Playwright runs at full speed, so timing bugs that Cypress hides behind its command queue surface immediately. See [Writing Tests](docs/WRITING-TESTS.md) for the full story on why and how.

## Developer Tools

```bash
yarn po-index            # List all POs with class, selector, and methods
yarn po-diff             # Compare POs against upstream Cypress
yarn gap-map             # Generate assertion gap map (upstream vs ours)
yarn summarize-failures  # Classify test failures after a run
```

## License

Copyright 2024-2026 Izaac Zavaleta
Copyright 2024-2026 SUSE LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

> http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

This project is derived from the [Rancher Dashboard](https://github.com/rancher/dashboard) Cypress E2E test suite, which is also licensed under the Apache License, Version 2.0.
