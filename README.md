# Rancher Dashboard E2E — Playwright

Playwright E2E test suite for [Rancher Dashboard](https://github.com/rancher/dashboard), migrated from the upstream Cypress suite.

This isn't a find-and-replace from Cypress to Playwright. Every test was rewritten to work reliably against a shared Rancher instance:

- **Atomic** — each test sets up what it needs, does its thing, and cleans up. No test depends on another running first.
- **Idempotent** — run a test once or fifty times, pass or fail midway — it still works next time. State is never assumed, always set explicitly.
- **Web-first assertions** — Playwright's auto-retrying assertions (`await expect(loc).toBeVisible()`) replace the snapshot-read pattern that causes flaky failures in naive conversions.
- **No raw selectors in specs** — every CSS selector and `data-testid` lives in a Page Object. Spec files read like plain English.
- **Explicit cleanup** — every resource a test creates gets cleaned up in `try/finally` or a Playwright fixture. No test relies on the next one to reset state.

## Quick Start

```bash
# Install dependencies
yarn install
npx playwright install chromium

# Configure environment
cp .env.example .env
# Edit .env with your Rancher instance URL and credentials

# Run tests
npx playwright test

# Run a single spec
npx playwright test e2e/tests/pages/generic/login.spec.ts

# Run by test name
npx playwright test -g "Log in with valid"

# Or start Rancher + run everything in Docker (no local setup needed)
docker compose up
```

For the full story — tag filtering, Docker modes, sharding, debugging — see the guides below.

## Guides

| Guide | What it covers |
|---|---|
| **[Running Tests](docs/RUNNING-TESTS.md)** | Every way to run tests — native, Docker, sharded, tags, environment variables, debugging failures |
| **[Writing Tests](docs/WRITING-TESTS.md)** | How to write a new test — Page Objects, fixtures, golden rules, blueprints, step-by-step walkthrough |
| **[Parallelism](docs/PARALLELISM.md)** | Which specs can run in parallel vs which need serial execution |

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

### Why not just swap `cy.get()` for `page.locator()`?

Cypress queues every command and adds invisible waits between steps. That's convenient, but it hides timing bugs — tests pass because they're accidentally slow enough. Playwright runs at full speed, so those hidden races surface immediately. Good for reliability, but it means you can't just transliterate Cypress tests line by line.

Here's what changes:

1. **Web-first assertions instead of snapshot reads.** Cypress `cy.get('.row').should('be.visible')` retries automatically. A naive Playwright translation like `expect(await loc.isVisible()).toBe(true)` reads the DOM exactly once — if the element hasn't rendered, the test fails. We write `await expect(loc).toBeVisible()` instead, which polls until the condition is true or timeout expires.

2. **Every test stands on its own.** The upstream Cypress suite uses `testIsolation: 'off'` — one test navigates somewhere, the next picks up from there. That's fragile and prevents running tests individually. Every Playwright test starts fresh: login, navigate, assert, clean up.

3. **Vue debounce handling.** Rancher Dashboard components debounce form changes (typically 500ms before emitting). Cypress is slow enough that it never notices. Playwright clicks Save before the debounce fires, so form data never reaches the API. Our Page Objects have `waitFor*Debounce()` methods for affected components.

### Web-first assertions at a glance

| Reads DOM once (flaky) | Retries automatically (stable) |
|---|---|
| `expect(await loc.isVisible()).toBe(true)` | `await expect(loc).toBeVisible()` |
| `expect(await loc.innerText()).toBe('x')` | `await expect(loc).toHaveText('x')` |
| `expect(await loc.inputValue()).toBe('x')` | `await expect(loc).toHaveValue('x')` |
| `expect(await loc.count()).toBe(3)` | `await expect(loc).toHaveCount(3)` |

## Developer Tools

```bash
yarn po-index            # List all POs with class, selector, and methods
yarn po-diff             # Compare POs against upstream Cypress
yarn gap-map             # Generate assertion gap map (upstream vs ours)
yarn summarize-failures  # Classify test failures after a run
```

See [Writing Tests](docs/WRITING-TESTS.md) for details on each tool.

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
