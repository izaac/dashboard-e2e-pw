# Claude Code Instructions

> Claude-specific config. Core rules live in AGENTS.md.

See @AGENTS.md for Monko identity, Caveman protocol, and agent boundaries.

## Project Context

- @README.md
- @playwright.config.ts
- @support/fixtures/index.ts

## Project Overview

Playwright E2E test suite for Rancher Dashboard, migrated from Cypress. Tests interact with a live Rancher instance via browser automation and direct API calls.

## Tech Stack

- **Framework:** Playwright Test (`@playwright/test`)
- **Language:** TypeScript (strict mode)
- **Pattern:** Page Object Model (PO) — mirrors upstream Cypress structure
- **API Helper:** `RancherApi` class injected via Playwright fixture
- **Auth:** `login()` fixture performs UI login per-test
- **Assertions:** Playwright built-in `expect` (not Chai)
- **Accessibility:** `@axe-core/playwright`
- **CI Reporter:** JUnit + Qase (`playwright.config.jenkins.ts`)

## Architecture

```
e2e/
  tests/          # Spec files — import POs and fixtures, no raw selectors
  po/
    components/   # Reusable UI component POs (LabeledInput, AsyncButton, etc.)
    pages/        # Full-page POs (LoginPage, HomePage, etc.)
    lists/        # Resource list POs
    prompts/      # Dialog/modal POs
    side-bars/    # Navigation POs (BurgerMenu, ProductNav)
    detail/       # Resource detail POs
    edit/         # Resource create/edit POs
  blueprints/     # Test data fixtures (JSON/TS)
support/
  fixtures/       # Playwright fixtures (login, rancherApi, envMeta)
  utils/          # Shared utilities
```

## Conversion Patterns (Cypress → Playwright)

| Cypress | Playwright |
|---|---|
| `cy.get('[data-testid="x"]')` | `page.getByTestId('x')` |
| `cy.get('.class')` | `page.locator('.class')` |
| `.should('be.visible')` | `await expect(loc).toBeVisible()` |
| `.should('contain.text', t)` | `await expect(loc).toContainText(t)` |
| `.should('have.value', v)` | `await expect(loc).toHaveValue(v)` |
| `.should('not.exist')` | `await expect(loc).not.toBeAttached()` |
| `cy.intercept('POST', url).as('x')` | `page.waitForResponse(url)` (BEFORE action) |
| `cy.intercept(url, mock)` | `page.route(url, route => route.fulfill({body}))` |
| `cy.visit('/path')` | PO `goTo()` (uses `./path` relative to baseURL) |
| `cy.login()` | `await login()` fixture |
| `Cypress.env('x')` | `envMeta.x` |
| `cy.request()` | `rancherApi.*` methods |
| `{ tags: ['@foo'] }` | `{ tag: ['@foo'] }` |
| `describe/it` | `test.describe/test` |
| `before/beforeEach` | `test.beforeAll/test.beforeEach` |

## Key Rules

### Page Objects

- Every PO constructor takes `page: Page` as first arg
- `self()` returns a `Locator` (equivalent of Cypress `self()` returning Chainable)
- Component POs extend `ComponentPo`, page POs extend `PagePo`
- **Same class names and method names as upstream Cypress POs**
- **Same CSS selectors and data-testid values as upstream**
- All methods are `async` and return `Promise<void>` or `Locator`
- Selectors live in POs only — never in spec files

### Specs

- Import `test` and `expect` from `@/support/fixtures` (not `@playwright/test` directly)
- Use `login()` fixture in `beforeEach` when auth is needed
- Use `rancherApi` fixture for API operations (create/delete resources)
- `waitForResponse` must be set up BEFORE the action that triggers it
- URLs use `./path` prefix (relative to baseURL) — never absolute `/path`
- **Don't clone upstream config** — match the assertions, not the test structure. Cypress `testIsolation: 'off'` and shared state are anti-patterns we avoid

### Test Isolation (Playwright official + our extensions)

These rules are verified against Playwright's official best practices documentation.

**Atomicity** — from Playwright: "Each test should be completely isolated and run independently." Playwright calls this "starting from scratch" and explicitly warns that the alternative (cleaning up between tests) "can lead to forgotten cleanups and state leaks, causing failures and harder debugging."
- Each test sets up its own preconditions (via API or UI), asserts, and cleans up
- No dependency on test execution order — any test must pass when run alone
- No shared mutable state between tests (`let` at describe scope that one test writes and another reads)

**Idempotency** — our extension beyond Playwright's docs, required because tests share a live Rancher instance:
- Tests must produce the same result on run 1, run N, and after partial failures
- Use `rancherApi` to query current state, set what you need, restore when done — never assume defaults
- Use unique test data (`Date.now()` suffixes) to avoid collisions with parallel runs
- If a resource might already exist, check first — don't fail on "already exists"

**Resource cleanup patterns** (in order of preference):
1. **Playwright fixtures with `use()`** — framework-guaranteed teardown, best for reusable resource patterns (browser contexts, API clients, authenticated sessions). This is what Playwright's docs recommend as the primary pattern.
2. **`try/finally` inside the test** — correct for per-test resources with dynamic IDs created mid-test. Cleanup runs on assertion failure. Only risk: process crash skips `finally` (rare in E2E).
3. **`afterEach`/`afterAll`** — acceptable for shared setup (e.g., one resource used by all tests in a describe). Requires shared variable at describe scope. Use sparingly — it couples tests.
4. **Never: no cleanup** — every resource created must be cleaned up. "The next test will reset it" is not acceptable.

**Web-first assertions** — from Playwright: use `await expect(loc).toBeVisible()`, never `expect(await loc.isVisible()).toBe(true)`. Web-first assertions auto-retry; manual checks race against the DOM.

**Locator preference** — from Playwright: prefer `getByTestId`, `getByRole`, `getByText` over raw CSS selectors. We use `getByTestId` to match upstream Rancher `data-testid` attributes.

### URL Resolution

`baseURL` ends with `/` (e.g. `https://host/dashboard/`). Page objects use `./auth/login` so Playwright resolves to `https://host/dashboard/auth/login`. Using `/auth/login` would resolve to `https://host/auth/login` (wrong).

## Running Tests

```bash
# All tests
npx playwright test

# By folder
npx playwright test e2e/tests/navigation

# By test name
npx playwright test -g "Log in with valid"

# Headed
npx playwright test --headed

# Debug (step through)
npx playwright test --debug

# CI config
npx playwright test --config=playwright.config.jenkins.ts

# View report
npx playwright show-report
```

## Environment Variables

Set in `.env` or export:

| Variable | Required | Default | Description |
|---|---|---|---|
| `TEST_BASE_URL` | Yes | `https://localhost:8005` | Dashboard URL (include `/dashboard`) |
| `TEST_PASSWORD` | Yes | — | Login password |
| `TEST_USERNAME` | No | `admin` | Login username |
| `CATTLE_BOOTSTRAP_PASSWORD` | Setup only | — | Bootstrap password for first login |
| `TEST_SKIP` | No | — | Comma-separated dirs to skip |
| `TEST_ONLY` | No | — | Comma-separated dirs to run exclusively |
| `GREP_TAGS` | No | — | Filter tests by tag |

## Test Tags (from upstream)

**User roles:** `@adminUser`, `@standardUser`, `@standardUserProject`, `@standardUserSetup`
**Features:** `@generic`, `@usersAndAuths`, `@userMenu`, `@globalSettings`, `@manager`, `@explorer`, `@explorer2`, `@fleet`, `@components`, `@navigation`, `@extensions`, `@charts`, `@provisioning`, `@elemental`, `@accessibility`
**CI/Edition:** `@jenkins`, `@prime`, `@noPrime`, `@noVai`
**Special:** `@flaky`

## Qase Integration

Qase IDs are added manually by QA. **Never generate or guess Qase IDs.** The reporter is configured in `playwright.config.jenkins.ts` — specs don't need any Qase-specific code until QA maps them.

## Developer Tooling

### Failure Summarizer
After a test run with failures, run:
```bash
yarn summarize-failures
```
Reads all artifacts from `test-results/`, classifies each failure (timeout, selector, API error, assertion, crash, navigation), cross-references network errors with the failure type, detects DOM state flags (loading spinners, login page visible, error banners), and outputs a single `test-results/FAILURE-SUMMARY.md`. Agents should read this file FIRST before diving into individual artifacts.

### PO Index
```bash
yarn po-index
```
Generates `e2e/po/INDEX.md` — a table of all Page Objects with class name, parent, selector, and key methods. Updated automatically on pre-commit. Agents MUST read this before searching for POs manually.

### PO Upstream Diff
```bash
yarn po-diff
```
Generates `e2e/po/UPSTREAM-DIFF.md` — compares all Playwright POs against upstream Cypress POs. Shows missing methods, extra methods, and unported POs. Agents MUST run this instead of manually comparing PO files against upstream.

### Assertion Gap Map
```bash
yarn gap-map
```
Generates `docs/ASSERTION-GAP-MAP.md` — compares upstream Cypress specs against Playwright specs. Shows per-suite conversion progress, unconverted specs, and test count deltas. Agents MUST run this instead of manually counting tests.

### Pre-commit Hooks
Husky + lint-staged runs on every commit:
1. ESLint + Prettier on staged `.ts` files
2. PO index regeneration (auto-stages `INDEX.md` if changed)

## Claude-Specific Rules

- Use `adaptive` thinking with `low` effort for simple tasks; reserve `high` for architecture.
- Run `/compact` at ~50% context. Run `/clear` between unrelated tasks.
- Use subagents for codebase exploration — keeps main context clean.
- Never load full docs when a link or `@` import suffices.
- Point to specific files and line numbers in prompts — vague = expensive.
- **Always query Context7** before implementing patterns you are not 100% certain about — especially test design (cleanup, fixtures, assertions), Playwright API usage, and any library/framework best practices. Training data may be stale; Context7 has current docs. This applies to both main context and subagents.

## Deep Docs (load only when needed)

- @e2e/po/components/component.po.ts — Base component PO pattern
- @e2e/po/pages/page.po.ts — Base page PO pattern
- @support/fixtures/rancher-api.ts — Full API helper reference
- @globals.d.ts — Type definitions
