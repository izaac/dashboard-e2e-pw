# Rancher Dashboard E2E — Playwright

Playwright E2E test suite for [Rancher Dashboard](https://github.com/rancher/dashboard), migrated from the upstream Cypress suite.

This isn't a find-and-replace from Cypress to Playwright. Every test has been rewritten to actually work reliably against a shared Rancher instance — no more "works on my machine" or "just re-run it":

- **Atomic** — each test sets up what it needs, does its thing, and cleans up. No test depends on another test running first.
- **Idempotent** — run a test once or fifty times, pass or fail midway through — it still works the next time. State is never assumed, always checked and set explicitly.
- **Web-first assertions** — we use Playwright's auto-retrying assertions everywhere (`await expect(loc).toBeVisible()` instead of `expect(await loc.isVisible()).toBe(true)`). This is the single biggest difference from Cypress — it eliminates an entire class of flaky failures caused by reading the DOM too early.
- **No raw selectors in specs** — every CSS selector and `data-testid` lives in a Page Object. Spec files read like plain English.
- **Explicit cleanup** — every resource a test creates gets cleaned up in `try/finally` or a Playwright fixture. We don't rely on "the next test will reset it".

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
npx playwright test e2e/tests/navigation/header.spec.ts

# Run by test name
npx playwright test -g "Log in with valid"
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `TEST_BASE_URL` | Yes | `https://localhost:8005` | Dashboard URL (include `/dashboard`) |
| `TEST_PASSWORD` | Yes | — | Login password |
| `TEST_USERNAME` | No | `admin` | Login username |
| `CATTLE_BOOTSTRAP_PASSWORD` | Setup only | — | Bootstrap password for first login |

## Architecture

```
e2e/
  tests/          # Spec files
  po/             # Page Objects (mirrors upstream Cypress structure)
  blueprints/     # Test data fixtures
support/
  fixtures/       # Playwright fixtures (login, rancherApi, envMeta)
  utils/          # Shared utilities
scripts/          # Developer tooling (gap-map, po-index, po-diff)
docs/             # Conversion roadmap, assertion gap map
```

## Test Design

### Why not just swap `cy.get()` for `page.locator()`?

Cypress queues every command and adds invisible waits between steps. That's convenient, but it also hides timing bugs — your tests pass because they're accidentally slow enough. Playwright runs at full speed, so those hidden races blow up immediately. That's a good thing, but it means you can't just transliterate Cypress tests line by line.

Here's what we do differently:

1. **Web-first assertions instead of snapshot reads.** When Cypress does `cy.get('.row').should('be.visible')`, it retries automatically. A naive Playwright translation like `expect(await loc.isVisible()).toBe(true)` reads the DOM exactly once — if the element hasn't rendered yet, the test fails. Instead we write `await expect(loc).toBeVisible()`, which keeps polling until the condition is true or timeout expires.

2. **Every test stands on its own.** The upstream Cypress suite uses `testIsolation: 'off'` — one test navigates somewhere, the next test picks up from there. That's fragile and prevents running tests individually. Every Playwright test starts fresh: login, navigate, assert, clean up.

3. **Vue debounce handling.** Rancher Dashboard components debounce form changes (typically 500ms before emitting to the parent). Cypress is slow enough that it never notices. Playwright clicks Save before the debounce fires, so the form data never reaches the API. Our Page Objects have `waitFor*Debounce()` methods for affected components.

### Web-first assertions at a glance

| ❌ Reads DOM once (flaky) | ✅ Retries automatically (stable) |
|---|---|
| `expect(await loc.isVisible()).toBe(true)` | `await expect(loc).toBeVisible()` |
| `expect(await loc.innerText()).toBe('x')` | `await expect(loc).toHaveText('x')` |
| `expect(await loc.inputValue()).toBe('x')` | `await expect(loc).toHaveValue('x')` |
| `expect(await loc.count()).toBe(3)` | `await expect(loc).toHaveCount(3)` |



```bash
yarn po-index            # Regenerate PO index
yarn po-diff             # Compare POs against upstream Cypress
yarn gap-map             # Generate assertion gap map
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
