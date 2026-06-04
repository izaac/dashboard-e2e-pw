# Upstream Divergences

This document tracks **intentional differences** between our Playwright port and the upstream
Cypress suite. These are not bugs or gaps; they are cases where Playwright's architecture lets
us solve a problem more cleanly than Cypress can, or where upstream patterns would be
anti-patterns in Playwright.

Use this as a reference when reviewing upstream Cypress changes. If an upstream commit touches
one of these areas, check here first, since the change may not apply to us, or may already be
handled differently.

---

## Table of Contents

1. [Chart Availability Skip Logic](#1-chart-availability-skip-logic)
2. [Idempotency (Test Isolation + Resource Cleanup)](#2-idempotency-test-isolation--resource-cleanup)
3. [Intercept / Response Timing](#3-intercept--response-timing)
4. [Vue Debounce Handling](#4-vue-debounce-handling)
5. [Vue v-model and fill()](#5-vue-v-model-and-fill)
6. [Visual Snapshots (Percy → Playwright)](#6-visual-snapshots-percy--playwright)
7. [Elemental Extension Coverage](#7-elemental-extension-coverage)
8. [Navigation: goTo() for Setup vs. Dedicated Walks](#8-navigation-goto-for-setup-vs-dedicated-walks)

---

## 1. Chart Availability Skip Logic

**Upstream (Cypress):** Uses `runTestWhenChartAvailable()` which queries the catalog index,
then either runs the test callback or calls `mochaContext.skip()`. Requires a
`CYPRESS_ALLOW_FILTERED_CATALOG_SKIP` environment variable to allow skipping. Without it,
filtered charts cause a hard failure.

```typescript
// Cypress: needs env var + mocha context threading
runTestWhenChartAvailable('rancher-charts', 'rancher-monitoring', this, () => {
  // test body lives inside callback
});
```

**Our approach (Playwright):** A `chartGuard` fixture that returns a function. The function
queries the same catalog index but uses Playwright's native `test.skip()`, with no env var, no
callback wrapping, no mocha context. Filtered charts skip automatically. Catalog errors
(empty index, broken repo) still hard-fail.

```typescript
// Playwright: clean skip, no env var, no callback nesting
test('install monitoring', async ({ chartGuard, page }) => {
  await chartGuard('rancher-charts', 'rancher-monitoring');
  // test body continues normally
});
```

**Why diverge:** Cypress cannot call `this.skip()` outside a callback because Mocha needs the
test context. Playwright's `test.skip()` works anywhere inside a test function, so no wrapper is
The env var exists in upstream because CI environments want to control whether filtered
charts fail or skip; our approach skips by default because a chart filtered by Rancher's version
compatibility is not a test failure.

**Upstream commits this replaces:** `f4225d2757`, `12e09817ba`

---

## 2. Idempotency (Test Isolation + Resource Cleanup)

**Upstream (Cypress):** Many describe blocks use `testIsolation: 'off'`, which means tests
within a block share browser state. Tests depend on execution order, so test 2 assumes test 1
already navigated to the right page or created a resource. `before()` runs once, and individual
tests pick up where the previous one left off. Cleanup lives in `after()` or `afterEach()` hooks
and often relies on the next test's `before()` to reset state. If a test crashes or times out,
the `after()` hook may still run, but resources created by individual tests within the block
can leak because the cleanup assumes an ordered chain of tests completed successfully.

**Our approach (Playwright):** Every test is idempotent. It produces the same result whether
it runs first, last, once, or a hundred times. This comes from two Playwright-native patterns
working together:

1. **Test isolation:** Every test gets a fresh browser context (`test.beforeEach` with
   `login()`). Tests set up their own preconditions via API (`rancherApi`), assert, and clean
   up. No test depends on another test's side effects.

2. **Resource cleanup via `try/finally`:** Resources created mid-test are wrapped in
   `try/finally` so cleanup runs even when assertions fail. For shared fixtures, Playwright's
   `use()` pattern provides framework-guaranteed teardown.

3. **Pre-test cleanup in `beforeEach`:** Catches leaks from previous crashed runs. If a worker
   dies mid-test, the `finally` block never executes, but the next run's `beforeEach` cleans
   up the orphaned resource before creating a new one.

```typescript
test.describe('Repositories', () => {
  test.beforeEach(async ({ rancherApi, login }) => {
    // Catch leaked resources from crashed previous runs
    await rancherApi.deleteClusterRepoIfExists('e2e-test-repo');
    await login();
  });

  test('create and verify repo', async ({ page, rancherApi }) => {
    await rancherApi.createClusterRepo('e2e-test-repo', repoUrl);
    try {
      // ... assertions ...
    } finally {
      await rancherApi.deleteClusterRepo('e2e-test-repo');
    }
  });
});
```

**Why diverge:** Playwright creates isolated browser contexts per test by default. Fighting this
with shared state would be fragile and against the framework's design. API-based setup is faster
than UI-based setup chains and eliminates flaky ordering dependencies. The three-layer cleanup
strategy (`beforeEach` catch leaks → `try/finally` per-test → `use()` for fixtures) makes tests
genuinely safe to run in any order, at any frequency, against any server state.

**Impact on upstream review:** When upstream adds a new test inside a `testIsolation: 'off'`
block that relies on state from a previous test, we must add explicit API setup for that state
instead of copying the dependency.

---

## 3. Intercept / Response Timing

**Upstream (Cypress):** Uses `cy.intercept().as('alias')` before the action, then
`cy.wait('@alias')` after. The intercept is declarative and Cypress handles the timing
internally through its command queue.

```typescript
cy.intercept('POST', '/v1/catalog.cattle.io.clusterrepos').as('createRepo');
cy.get('[data-testid="action-button-async-button"]').click();
cy.wait('@createRepo').its('response.statusCode').should('eq', 201);
```

**Our approach (Playwright):** Set up `page.waitForResponse()` **before** the click (returns a
promise), perform the click, then `await` the promise. The promise must be created before the
action or we risk missing the response.

```typescript
const createResponse = page.waitForResponse(
  (resp) => resp.url().includes('/v1/catalog.cattle.io.clusterrepos') && resp.request().method() === 'POST'
);
await actionButton.click();
const resp = await createResponse;
expect(resp.status()).toBe(201);
```

**Why diverge:** Playwright does not have a Cypress-style intercept queue. `waitForResponse` is
the idiomatic way to wait for network activity. The "promise before action" pattern is critical, because
reversing the order causes intermittent misses.

---

## 4. Vue Debounce Handling

**Upstream (Cypress):** Cypress command queue serializes with implicit waits between each
command. The cumulative delay from `cy.get()`, `cy.type()`, `cy.click()` chains naturally
exceeds Vue's 500ms debounce windows. Tests pass without any explicit debounce handling.

**Our approach (Playwright):** Playwright executes commands as fast as the browser allows. After
filling a debounced input, the next action (e.g., Save) can fire before Vue's `$emit` propagates.
Page Objects for known debounced components provide `waitFor*Debounce()` methods.

**Why diverge:** Playwright is genuinely faster than Cypress at interacting with the DOM. This
is a feature, but it exposes timing assumptions in Rancher's Vue components that Cypress hides.
When porting a test that fills a form and saves, always check the Vue component source for
`debounce` in `created()` or `setup()`. See `DEBUGGING-FAILURES.md` for detection tips.

---

## 5. Vue v-model and fill()

**Upstream (Cypress):** `cy.type()` dispatches real keyboard events one character at a time,
which triggers Vue's `@input` / `@change` handlers and keeps `v-model` in sync with the DOM.

**Our approach (Playwright):** `locator.fill()` writes directly to the input's value property
and dispatches `input` + `change` events. This works for most inputs, but Vue components that
use `:value` bindings (not `v-model`) or computed getters can overwrite the filled value on
the next render cycle. The DOM shows the correct value, but Vue's internal state holds the
old value, and that is what gets submitted.

**Known affected:**

- Rancher setup page (`shell/pages/auth/setup.vue`): `password` field uses `:value` bound
  to a `data()` property initialized with a random string

**Workaround:** When `fill()` doesn't stick, intercept the API request with `page.route()` and
rewrite the payload in-flight. See `DEBUGGING-FAILURES.md` for detection patterns.

---

## 6. Visual Snapshots (Percy → Playwright)

**Upstream (Cypress):** Visual regression uses `cy.percySnapshot()` from `@percy/cypress`.
Baselines are stored in Percy's cloud, diffs are reviewed in the Percy web UI, and runs
require a `PERCY_TOKEN` plus the Percy CLI in CI.

**Our approach (Playwright):** Built-in `expect(page).toHaveScreenshot()`. Baselines live
in the repo next to specs (`*-snapshots/`), diffs are local pixel comparisons via
`pixelmatch`, and `--update-snapshots` regenerates baselines on intentional UI changes.
No external service, no token, no separate CLI. Tagged `@visual` so they can be filtered
in or out of normal runs.

**Why diverge:** Percy adds cost and a cloud dependency we don't need at this stage.
Playwright's built-in covers the same use case (rendering regressions) with `mask`,
`maxDiffPixelRatio`, and `threshold` to absorb anti-aliasing and timestamp churn. If we
ever need cross-browser baseline review or PR-level visual diffs in a hosted UI, Percy
can be re-added on top, and the snapshot tests themselves stay valid.

**Conventions for our visual tests** (`support/utils/visual-snapshot.ts`):

- **Mode-keyed paths.** Prime and Community render different brand palettes, so a single
  baseline can't match both. `visualSnapshot(isPrime, name)` produces a path-segment
  array that lands the file under `prime/` or `community/` next to the spec.
- **Theme pinned to light, then restored.** The user's stored theme can drift across
  the suite (`preferences.spec.ts` cycles Light → Dark → Auto without reverting), so
  visual tests pin `ui-light` and restore the previous value in a `finally` block.
  Ensures the baseline is reproducible regardless of suite ordering.
- **Wait for content, not just URL.** `waitForPage` only matches the URL, so the
  dashboard shell can still be showing its loading spinner. `SortableTablePo.waitForReady()`
  waits for the table header so the screenshot captures real content, not the spinner.

**Upstream pattern this replaces:** any `cy.percySnapshot('Page Name')` call.

---

## 7. Elemental Extension Coverage

**Upstream (Cypress):** Removed in [`55da6031`](https://github.com/rancher/dashboard/commit/55da603163)
(May 2026), deleting `cypress/e2e/tests/extensions/elemental/elemental.spec.ts` plus
`elemental.utils.ts` and `extensions-compatibility.utils.ts`, with the rationale
"deprecated for a long time." Upstream is moving extension coverage to an AI-backed
automatic harness rather than per-extension Cypress specs.

**Ours:** Kept and hardened. `e2e/tests/extensions/elemental/elemental.spec.ts` (gold-shape
rewrite, API-seeded preconditions, throw-on-timeout helpers, API truth-source for the
chart-installed-apps "Deployed" wait) plus the same PO chain (`elemental.utils.ts` →
`extensions-compatibility.utils.ts` parent class). The `extensions-compatibility.utils.ts`
class itself is generic. It is a base class with helpers for navigating to pages, lists, name
fields, and code-mirror, so the name is historical, not a sign that the file owns
deprecated functionality.

**Why diverge:** Until the AI-backed extension harness lands and proves out, our spec is
the only end-to-end coverage of the extension install flow against a real Rancher (repo
add → operator install → CRD finalizer cleanup → extension UI). Dropping it now would
leave a gap.

**When to revisit:** When upstream's replacement harness exists and covers the same
flows, port to that pattern and drop the local copy.

---

## 8. Navigation: goTo() for Setup vs. Dedicated Walks

**Upstream (Cypress):** Tests reach the page under test by clicking through the UI (burger menu,
then the product side-nav, `ProductNavPo`) even when navigation is only a precondition. Combined
with `testIsolation: 'off'`, nearly every test walks the menu, so the side-nav gets incidental
regression coverage for free across the whole suite.

**Our approach (Playwright):**

- **Setup navigation → `goTo()`** (`PagePo.goTo()`, i.e. a direct `page.goto()`). Idiomatic
  Playwright: faster, less flaky, and it does not couple every unrelated test to the side-menu
  rendering first.
- **Navigation-under-test → UI nav** (`BurgerMenuPo` / `ProductNavPo`). Reserved for tests whose
  subject *is* the menu or routing.
- When upstream used `navTo` purely as setup, we use `goTo()` and leave an inline
  `// TODO(upstream-parity): upstream uses navTo here` so the divergence stays auditable in a 1:1 diff.

```typescript
// Setup nav: get to the page directly, then test something else.
const deployments = new WorkloadsDeploymentsListPagePo(page, 'local');
await deployments.goTo(); // not burgerMenu.goToCluster() + productNav clicks
```

**Compensating coverage (critical):** `goTo()`-for-setup drops the incidental menu coverage Cypress
got for free, so the dedicated specs under `e2e/tests/navigation/side-nav/` must explicitly walk
**every** side-nav path or a broken link slips through silently. Two properties make this non-trivial:

- **The nav is server-driven and dynamic.** The product side-nav is assembled at runtime, and
  **installed Rancher extensions inject their own entries** into it. So the walk reads whatever the
  server renders (`ProductNavPo.groups()` / `visibleNavTypes()`, including nested sub-accordions) and
  walks all of it. It never asserts against a hardcoded menu, which would rot the moment an extension
  or an upstream resource registration changes the tree.
- **Landing must be asserted, not assumed.** Each hop is checked by `support/utils/nav-walk.ts`
  (`clickNavLinkAndAssertLanding`): the URL matches the link's destination, the destination actually
  rendered, the fail-whale error page is absent, and no uncaught JS error fired during the hop. The
  "rendered" signal must stay generic, because an extension page (or a non-list page like the Apps chart
  catalog) will not necessarily show the standard resource masthead.

The top-level/global burger entries are walked the same way by `main-side-menu.spec.ts`
("Should access every global menu link provided, without errors"): it re-opens the menu and
re-resolves the links fresh on each hop, so navigation closing the menu can't stale out the next
click. Those landings are heterogeneous (resource lists, the Fleet dashboard, tabbed pages) and
don't all expose an accessible page `<h1>`, so the walk passes `requireHeading: false`, asserting
routing + no fail-whale + no crash rather than a rendered masthead.

**Why diverge:** `navTo`-for-every-setup is a classic Cypress idiom that becomes an anti-pattern in
Playwright. It is slower, and it makes unrelated tests fail when the menu render hiccups. Playwright best
practice (official docs) is `goTo()` for setup and UI-driven nav only when navigation is the thing
under test. Port auditability (1:1 vs upstream) is real but secondary, and is satisfied by the TODO
breadcrumb plus the dedicated walks, not by mirroring every nav verb.

**Impact on upstream review:** Port `navTo`-style setup navigation as `goTo()` (+ TODO breadcrumb).
When upstream adds a *new* nav target, extend `BurgerMenuPo` / `ProductNavPo` (don't inline selectors
in specs) and confirm the dedicated walk still covers the new path. Do not convert the nav walk into a
fixed expected-entries list, because extension-injected entries mean the set is intentionally open-ended.

---

## Adding New Entries

When you find a new intentional divergence from upstream:

1. Add a section here with: upstream pattern, our pattern, and why we diverge
2. Reference the upstream commit(s) if the divergence was prompted by a specific change
3. Keep examples minimal, linking to the real code for full context
