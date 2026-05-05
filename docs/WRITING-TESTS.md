# Writing E2E Tests

How to write Playwright tests for this project. If you know basic TypeScript, you have everything
you need — this guide covers the rest.

---

## Table of Contents

1. [How a Test File Looks](#1-how-a-test-file-looks)
2. [Page Objects (POs)](#2-page-objects-pos)
3. [Fixtures (login, rancherApi, envMeta, isPrime, chartGuard)](#3-fixtures-login-rancherapi-envmeta-isprime-chartguard)
4. [The Golden Rules](#4-the-golden-rules)
5. [Writing a Test Step by Step](#5-writing-a-test-step-by-step)
6. [Blueprints (Mock Data)](#6-blueprints-mock-data)
7. [Common Patterns](#7-common-patterns)
8. [Visual Snapshots](#8-visual-snapshots)
9. [Checklist Before You Commit](#9-checklist-before-you-commit)
10. [Developer Tools](#10-developer-tools)

---

## 1. How a Test File Looks

Here's a complete, simple test. Read through it — then we'll break down each piece.

```typescript
import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';

test.describe('Home Page', { tag: ['@adminUser', '@generic'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('should display the welcome banner', async ({ page }) => {
    const homePage = new HomePagePo(page);

    await homePage.goTo();
    await homePage.waitForPage();

    await expect(homePage.title()).toContainText('Welcome');
  });
});
```

Let's walk through each piece:

### Imports

```typescript
import { test, expect } from '@/support/fixtures';
```

**Always** import `test` and `expect` from `@/support/fixtures` — never from `@playwright/test`
directly. Our custom fixtures (login, API helpers, environment config) are wired into that import.

### Tags

```typescript
test.describe('Home Page', { tag: ['@adminUser', '@generic'] }, () => {
```

Tags go in the second argument of `test.describe()` or `test()`. They describe who can run this
test (`@adminUser`, `@standardUser`) and what feature area it covers (`@generic`, `@explorer`,
`@fleet`, etc.).

### Login

```typescript
test.beforeEach(async ({ login }) => {
  await login();
});
```

The `login()` fixture handles authentication — it logs into Rancher via the UI. Call it in
`beforeEach` so every test starts with a fresh logged-in session.

### Page Objects

```typescript
const homePage = new HomePagePo(page);
await homePage.goTo();
```

Page Objects handle all the selectors and UI interactions. Your spec file reads like plain
English — "go to the home page", "check the title". No CSS selectors in sight.

### Assertions

```typescript
await expect(homePage.title()).toContainText('Welcome');
```

All assertions use `await expect(...)`. These are "web-first" assertions — they automatically
retry until the condition is true (or timeout). This means you don't need manual waits or
sleep calls.

---

## 2. Page Objects (POs)

A Page Object is a class that knows how to interact with one page or one UI component. It holds
all the selectors so your test files stay clean.

**Why bother?** If a developer changes a button's CSS class, you fix one PO file instead of twenty spec files.

### Component PO

Component POs represent reusable UI pieces (inputs, buttons, dropdowns). They extend `ComponentPo`:

```typescript
import { type Page, type Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class LabeledInputPo extends ComponentPo {
  constructor(page: Page, selector: string) {
    super(page, selector);
  }

  input(): Locator {
    return this.self().locator('input');
  }

  async set(value: string): Promise<void> {
    await this.input().fill(value);
  }

  async clear(): Promise<void> {
    await this.input().clear();
  }
}
```

### Page PO

Page POs represent full pages (Home, Login, Settings). They extend `PagePo`:

```typescript
import { type Page, type Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';

export default class HomePagePo extends PagePo {
  static url = './home';

  constructor(page: Page) {
    super(page, HomePagePo.url);
  }

  title(): Locator {
    return this.page.getByTestId('banner-title');
  }

  manageButton(): Locator {
    return this.page.getByTestId('cluster-management-manage-button');
  }
}
```

### Key rules

- Component POs extend `ComponentPo`, page POs extend `PagePo`
- `self()` returns the root Locator for this PO — think of it as "the element this PO wraps"
- Methods that **find** an element return a `Locator`
- Methods that **do** something (click, fill, navigate) are `async` and return `Promise<void>`
- Match the upstream Cypress PO class names, method names, and selectors — we keep them in sync
- **POs never assert** — no `expect()` inside Page Objects. POs expose Locators and perform
  actions; specs own all assertions. The only exception is `waitFor*` helpers that check element
  visibility as a precondition (e.g., `waitForPage()`, `waitForDebounce()`), not as a test assertion

### Where do POs live?

```text
e2e/po/
  components/   → Reusable UI pieces (LabeledInput, AsyncButton, Checkbox...)
  pages/        → Full-page POs (HomePage, LoginPage, SettingsPage...)
  lists/        → Resource list pages (table views)
  prompts/      → Dialogs and modals
  side-bars/    → Navigation (BurgerMenu, ProductNav)
  detail/       → Resource detail views
  edit/         → Resource create/edit forms
```

### Before creating a new PO

Always check if one already exists:

```bash
# The PO index lists every PO with its class, selector, and methods
cat e2e/po/INDEX.md

# Compare against upstream Cypress POs to see what's ported
yarn po-diff
cat e2e/po/UPSTREAM-DIFF.md
```

---

## 3. Fixtures (login, rancherApi, envMeta, isPrime, chartGuard)

Fixtures are values that Playwright passes into your test functions automatically. We have
custom ones that you'll use in nearly every test.

### `login()` — Authenticate before your test

Logs into Rancher through the UI. Call it in `beforeEach`:

```typescript
test.beforeEach(async ({ login }) => {
  await login();
});
```

Need to log in as a specific user? Pass options:

```typescript
await login({ username: 'testuser', password: 'testpass' });
```

### `rancherApi` — Talk to Rancher's API directly

Use this to create resources, change settings, or clean up — all without touching the UI. It's
faster and more reliable than clicking through forms.

```typescript
test('create and verify a namespace', async ({ page, rancherApi }) => {
  const nsName = `test-ns-${Date.now()}`;

  await rancherApi.createNamespace(nsName);

  try {
    // Navigate and verify the namespace shows up in the UI
    // ... your assertions here ...
  } finally {
    // Always clean up what you created — deleteNamespace takes an array
    await rancherApi.deleteNamespace([nsName]);
  }
});
```

### `envMeta` — Environment configuration

Access environment variables like cloud credentials, the Rancher URL, or the login username.
Useful for skipping tests that need infrastructure you don't have:

```typescript
test('provision AKS cluster', async ({ envMeta }) => {
  test.skip(!envMeta.azureClientId, 'Requires Azure credentials');
  // ... test that needs Azure ...
});
```

Available properties include: `username`, `password`, `baseUrl`, `awsAccessKey`, `awsSecretKey`,
`azureClientId`, `azureClientSecret`, `gkeServiceAccount`, `customNodeIp`, and more
(see `globals.d.ts` for the full list).

### `isPrime` — Detect Rancher Prime vs Community

A worker-scoped boolean that queries `/rancherversion` once per worker and caches the result.
Use it to branch assertions or skip tests based on the Rancher edition:

```typescript
// Branch: same test, different expected value
test('favicon resets to default', async ({ page, isPrime }) => {
  const favicon = page.locator('head link[rel="shortcut icon"]');
  const expected = isPrime ? /data:image\/png;base64/ : /\/favicon\.png/;

  await expect(favicon).toHaveAttribute('href', expected);
});

// Skip: test only applies to one edition
test('shows prime support panel', async ({ isPrime }) => {
  test.skip(!isPrime, 'Prime only');
  // ...
});
```

This replaces upstream's `cy.getRancherVersion().then(...)` pattern — no async call in every
test, no callback nesting. Tags (`@prime` / `@noPrime`) control which tests **run** at CI level;
`isPrime` controls what to **expect** inside tests that run on both editions.

### `chartGuard` — Skip tests when charts are filtered

A test-scoped fixture that checks whether a Helm chart is available in the catalog. Call it
at the start of any chart test:

```typescript
test('install monitoring', async ({ chartGuard, page }) => {
  await chartGuard('rancher-charts', 'rancher-monitoring');
  // ... test body — only runs if the chart is in the catalog ...
});
```

Behavior:

- **Chart available** → test proceeds normally
- **Chart filtered** (hidden by Rancher's version compatibility rules) → `test.skip()`
- **Catalog broken** (empty index, repo not synced) → hard failure

Results are cached per worker, so multiple tests checking the same repo only fetch the catalog
index once. The fixture also enables the `show-pre-release` preference during the test and
restores it on teardown.

This replaces upstream's `runTestWhenChartAvailable()` + `CYPRESS_ALLOW_FILTERED_CATALOG_SKIP`
env var — no environment variable needed, no callback wrapping, no Mocha context threading.
See `docs/UPSTREAM-DIVERGENCES.md` for details.

---

## 4. The Golden Rules

These rules exist because our tests run against a shared, live Rancher instance. Breaking them
leads to flaky tests that fail randomly and waste everyone's time.

### Rule 1: Every test stands alone (Atomicity)

Each test must work independently — it can't depend on another test running first.

**Don't do this** — Test B assumes Test A already created a namespace:

```typescript
// Test A creates "my-namespace"
// Test B navigates to "my-namespace" and checks it
// If Test A is skipped or fails, Test B breaks too
```

**Do this instead** — Test B creates its own namespace, tests it, deletes it:

```typescript
test('can view namespace details', async ({ page, rancherApi }) => {
  const ns = `test-ns-${Date.now()}`;
  await rancherApi.createNamespace(ns);

  try {
    // Navigate, verify, assert
  } finally {
    await rancherApi.deleteNamespace([ns]);
  }
});
```

### Rule 2: Tests work on run 1 and run 100 (Idempotency)

Your test must produce the same result no matter how many times you run it.

**Don't do this** — a fixed name fails the second time because the resource already exists:

```typescript
await rancherApi.createNamespace('my-namespace');
// Second run: "my-namespace already exists"
```

**Do this instead** — use a unique name with a timestamp:

```typescript
const ns = `my-ns-${Date.now()}`;
await rancherApi.createNamespace(ns);
```

**Also fine** — pre-clean any leftover and re-create. `deleteRancherResource(...)`'s
`failOnStatusCode = false` flag tolerates a missing resource (404) without throwing,
so a no-op delete is safe — never use a silent `.catch(() => {})` (it swallows real
auth/network errors and violates the project's no-silent-failure rule):

```typescript
// Delete if leftover from a previous failed run; the `false` flag skips throw on 404
await rancherApi.deleteRancherResource('v1', 'namespaces', 'my-namespace', false);
await rancherApi.createNamespace('my-namespace');
```

### Rule 3: Always clean up

Every resource you create must be deleted when the test is done. Use `try/finally` so cleanup
runs even if your assertions fail:

```typescript
test('modify a setting', async ({ rancherApi }) => {
  const original = await rancherApi.getSetting('ui-brand');
  await rancherApi.setSetting('ui-brand', 'test-brand');

  try {
    // ... your assertions ...
  } finally {
    // Runs even if assertions fail
    await rancherApi.setSetting('ui-brand', original);
  }
});
```

**Cleanup priority** (use whichever fits):

1. **`try/finally` inside the test** — best for most cases, especially one-off resources
2. **`afterEach`/`afterAll`** — acceptable when multiple tests in the same `describe` share a resource
3. **Playwright fixtures with `use()`** — best for reusable patterns (advanced, see Playwright docs)

### Rule 4: No raw selectors in spec files

Selectors belong in Page Objects — never in your test file.

**Don't do this:**

```typescript
await page.locator('.btn.bg-primary').click();
await page.locator('[data-testid="banner-title"]').innerText();
```

**Do this instead:**

```typescript
await myPage.saveButton().click();
await myPage.title().innerText();
```

### Rule 5: Web-first assertions

Use `await expect(...)` — these retry automatically until the condition is true or the timeout
expires. Never check once with a manual boolean.

**Don't do this** — it checks the DOM once and moves on, which is a race condition:

```typescript
expect(await element.isVisible()).toBe(true);
```

**Do this instead** — it retries automatically until the element is visible (or times out):

```typescript
await expect(element).toBeVisible();
```

Here are the most common web-first assertions:

```typescript
await expect(locator).toBeVisible();
await expect(locator).toContainText('some text');
await expect(locator).toHaveValue('input value');
await expect(locator).toHaveAttribute('href', '/path');
await expect(locator).not.toBeAttached();   // element doesn't exist in DOM
```

### Rule 6: Assertions live in specs, not POs

Page Objects expose Locators and perform actions. Specs own all `expect()` calls. This keeps POs
reusable across tests that assert different things about the same element.

**Don't do this** in a PO:

```typescript
// BAD — PO is making a test assertion
async verifyTitle(expected: string): Promise<void> {
  await expect(this.title()).toContainText(expected);
}
```

**Do this instead** — PO returns the Locator, spec asserts:

```typescript
// PO
title(): Locator {
  return this.self().getByTestId('title');
}

// Spec
await expect(myPage.title()).toContainText('Welcome');
```

The only exception is `waitFor*` helpers inside POs that check element state as a **precondition**
(e.g., waiting for a page to load, a spinner to disappear, a debounce to settle). These are
navigation/timing helpers, not test assertions.

If you have a PO action that needs to verify an API response (e.g. "click save and check the
PUT returned 200"), return the `Response` from the action method and let the spec assert:

```typescript
// PO
async applyAndWait(endpoint: string): Promise<Response> {
  const responsePromise = this.page.waitForResponse(/* ... */);
  await this.applyButton().click();
  return responsePromise;
}

// Spec
expect((await myPage.applyAndWait('ui-banners')).status()).toBe(200);
```

If a helper genuinely needs to bundle the action + assertion (e.g. for a multi-step flow that
should fast-fail on a bad status), name it explicitly: `applyAndExpectOk(...)`,
`saveAndExpectStatus(...)`. The `AndExpect…` suffix telegraphs the hidden assertion to readers.

### Rule 7: No empty `catch` blocks

Never write `} catch {}`, `} catch { /* comment */ }`, or `.catch(() => {})` — even with a
comment. Silent swallows hide auth failures, network errors, and genuine test bugs that
otherwise look like UI flakes. Runtime helpers (e.g. cleanup helpers, polling catches) must
`console.warn` with context instead:

```typescript
// BAD — swallows everything, even auth/network failures
try {
  await api.deleteRancherResource('v1', 'configmaps', name, false);
} catch {}

// GOOD — `false` flag tolerates 404 without throwing; no catch needed
await api.deleteRancherResource('v1', 'configmaps', name, false);

// GOOD — when a catch IS needed, log so failures surface in CI
} catch (err) {
  console.warn(`[my-test cleanup] failed: ${(err as Error)?.message ?? err}`);
}
```

### Rule 8: No `page.waitForTimeout(N)` in specs; use named utils in POs

Specs should not contain fixed sleeps — `playwright/no-wait-for-timeout` is on at warn level.
Page Objects can have documented sleeps as a last resort (Vue debounce window, xterm canvas
output, mount-on-open transitions), but they MUST go through a named helper from
`@/support/utils/debounce` so the eslint-disable lives in one place and the intent is explicit:

```typescript
// PO debounce helper
import { waitForVueDebounce, waitForUiTransition, retryBackoff } from '@/support/utils/debounce';

async waitForKeyValueDebounce(): Promise<void> {
  await waitForVueDebounce(this.page);  // documented Vue 500ms debounce
}

async toggle(): Promise<void> {
  await this.dropdownButton().click();
  await waitForUiTransition(this.page);  // slide-in panel mounts at transition start
}
```

Never call `page.waitForTimeout(N)` directly from a PO method — add a util if a new pattern is
needed.

---

## 5. Writing a Test Step by Step

Let's walk through creating a brand-new test from scratch.

### Step 1: Find or create the Page Object

Check if a PO already exists for the page you're testing:

```bash
cat e2e/po/INDEX.md
```

If you find it, great — just import it. If not, create one following the patterns in [Section 2](#2-page-objects-pos).

### Step 2: Create the spec file

Spec files live in `e2e/tests/`, mirroring the app's page structure. Name it `<feature>.spec.ts`:

```text
e2e/tests/pages/global-settings/banners.spec.ts
e2e/tests/pages/explorer/dashboard/events.spec.ts
e2e/tests/pages/user-menu/preferences.spec.ts
```

### Step 3: Write the test

Start with this skeleton:

```typescript
import { test, expect } from '@/support/fixtures';
import MyPagePo from '@/e2e/po/pages/my-page.po';

test.describe('My Feature', { tag: ['@adminUser', '@generic'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('does the thing I expect', async ({ page }) => {
    const myPage = new MyPagePo(page);

    await myPage.goTo();
    await myPage.waitForPage();

    // Interact
    await myPage.someButton().click();

    // Assert
    await expect(myPage.resultMessage()).toContainText('Success');
  });
});
```

### Step 4: Run it

```bash
npx playwright test e2e/tests/pages/my-feature/my-test.spec.ts --reporter=line
```

### Step 5: Debug if it fails

See [Debugging Failures](DEBUGGING-FAILURES.md) for the full investigation workflow. Quick version:

```bash
# Summarize what went wrong
yarn summarize-failures
cat test-results/FAILURE-SUMMARY.md

# Watch the test run in the browser
npx playwright test e2e/tests/pages/my-feature/my-test.spec.ts --headed

# Step through interactively
npx playwright test e2e/tests/pages/my-feature/my-test.spec.ts --debug
```

---

## 6. Blueprints (Mock Data)

Sometimes you want to test the UI without creating real resources on the server. Blueprints are
factory functions that return fake API responses — you feed them to the browser so the UI renders
data without any backend round-trips.

### When to use blueprints

- Testing how the UI **renders** data (list views, detail pages, empty states)
- Testing UI behavior that doesn't need real resources (filtering, sorting, pagination)
- Avoiding slow resource creation when you just need the UI to show something

### Creating a blueprint

Blueprints live in `e2e/blueprints/` and export factory functions:

```typescript
// e2e/blueprints/explorer/workloads/small-collection.ts

export function smallCollectionResponse(resourceType: string) {
  const items = Array.from({ length: 3 }, (_, i) => ({
    id:       `default/item-${i}`,
    type:     resourceType,
    metadata: {
      name:              `item-${i}`,
      namespace:         'default',
      creationTimestamp: new Date().toISOString(),
      uid:               `uid-${i}`,
      state:             { error: false, message: '', name: 'active', transitioning: false },
    },
  }));

  return {
    type:         'collection',
    resourceType,
    count:        items.length,
    data:         items,
  };
}
```

### Using a blueprint in a test

```typescript
import { test, expect } from '@/support/fixtures';
import { smallCollectionResponse } from '@/e2e/blueprints/explorer/workloads/small-collection';

test('shows workload list', async ({ page, login }) => {
  // Set up the route BEFORE login — the mock must be active when the page loads
  await page.route('**/v1/apps.deployments*', (route) =>
    route.fulfill({ json: smallCollectionResponse('apps.deployment') })
  );

  await login();

  // Navigate and assert against the mocked data
  // ...
});
```

### Key points

- Blueprints are **factory functions**, not raw JSON blobs — this makes them reusable with different parameters
- `page.route()` **must** be set up **before** `await login()` — the route needs to be active when the page loads
- Use `route.fulfill({ json })` — Playwright handles serialization and Content-Type automatically

---

## 7. Common Patterns

### Waiting for an API response after a button click

If your test clicks a Save button and you need to wait for the API call to finish:

```typescript
// Set up the listener BEFORE the action
const saveResponse = page.waitForResponse(
  (resp) => resp.url().includes('/v1/secrets') && resp.request().method() === 'POST'
);

// Perform the action
await myPage.saveButton().click();

// Now wait for the response
await saveResponse;
```

**Important:** `waitForResponse` is set up *before* the click, then awaited *after*. If you set
it up after clicking, you might miss the response.

### Skipping tests that need special infrastructure

Some tests need cloud credentials, custom nodes, or specific Rancher features. Skip gracefully:

```typescript
test('provision EKS cluster', async ({ envMeta }) => {
  test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');
  // ...
});
```

This marks the test as skipped (not failed) with a clear reason in the report.

### Modifying an API response on the fly

Sometimes you need the real API response but with one field changed:

```typescript
await page.route('**/v1/provisioning.cattle.io.clusters*', async (route) => {
  const response = await route.fetch();          // Get the real response
  const json = await response.json();            // Parse it

  json.data[0].metadata.annotations['my-key'] = 'my-value';  // Modify

  await route.fulfill({ json });                 // Return the modified version
});
```

### Saving and restoring settings

When your test changes a Rancher setting, save the original and restore it:

```typescript
test.describe('Branding', () => {
  let originalBrand: string;

  test.beforeEach(async ({ rancherApi, login }) => {
    const resp = await rancherApi.getSetting('ui-brand');
    originalBrand = resp;
    await login();
  });

  test.afterEach(async ({ rancherApi }) => {
    await rancherApi.setSetting('ui-brand', originalBrand);
  });

  test('can change the brand', async ({ page, rancherApi }) => {
    await rancherApi.setSetting('ui-brand', 'test-brand');
    // ... navigate and verify ...
  });
});
```

### Vue debounce trap

Some Rancher form components wait 500ms before actually sending a value change to the app (this
is called debouncing). Playwright is fast enough to click Save before that delay finishes, which
means the value shows up correctly in the UI but never makes it into the API request.

If your test fills a form field and the value seems to "disappear" on save, this might be why.
Page Objects for known debounced components provide `waitFor*Debounce()` methods — call them
before saving.

---

## 8. Visual Snapshots

Visual tests use Playwright's built-in `expect(page).toHaveScreenshot()` — no Percy.
Add one when you want to catch unintentional rendering regressions on a stable UI
surface (list pages, settings forms, empty states). Don't use them as a substitute
for behavioral assertions.

### Anatomy of a visual test

```typescript
import { test, expect } from '@/support/fixtures';
import RepositoriesPagePo from '@/e2e/po/pages/chart-repositories.po';
import { ensureLightTheme, visualSnapshot } from '@/support/utils/visual-snapshot';

test.describe('Visual snapshots', { tag: ['@visual', '@manager', '@adminUser'] }, () => {
  test('repositories list page matches snapshot', async ({ page, login, rancherApi, isPrime }) => {
    await login();
    const restoreTheme = await ensureLightTheme(rancherApi);

    try {
      const repositoriesPage = new RepositoriesPagePo(page);

      await repositoriesPage.goTo();
      await repositoriesPage.waitForPage();
      await repositoriesPage.sortableTable().waitForReady();

      await expect(page).toHaveScreenshot(visualSnapshot(isPrime, 'repositories-list.png'), {
        fullPage: true,
        mask: [repositoriesPage.sortableTable().ageColumn()],
      });
    } finally {
      await restoreTheme();
    }
  });
});
```

### What each piece does

- **`@visual` tag** — keeps the test out of the default `GREP_TAGS` so normal runs
  don't pay the pixel-diff cost.
- **`ensureLightTheme(rancherApi)`** — pins the admin user to `ui-light` and returns a
  `restoreTheme` function. Required because `preferences.spec.ts` cycles Light → Dark
  → Auto without reverting; without the pin, suite ordering can break the baseline.
  Always call `restoreTheme()` in `finally`.
- **`waitForReady()`** — `waitForPage` only matches the URL. The dashboard shell can
  still be showing its loading spinner. `SortableTablePo.waitForReady()` waits for
  the table header so the screenshot captures real content. For pages without a
  sortable table, use a page-specific anchor (`mastheadTitle()` or a known testid).
- **`visualSnapshot(isPrime, name)`** — produces a path-segment array so the snapshot
  lands under `snapshots/<spec>/{prime,community}/<name>.png`. Prime ships a
  SUSE-themed brand palette, so the two editions need separate baselines.
- **`mask: [...ageColumn()]`** — masks the volatile Age column so "3 minutes ago" vs
  "4 minutes ago" doesn't fail the diff. Add a PO helper (like `ageColumn()`) for any
  other volatile content rather than inlining a raw selector in the spec.
- **`fullPage: true`** — captures the full scrollable page. Drop it for component-level
  snapshots and use a locator (`expect(locator).toHaveScreenshot(...)`) instead.

### Generating and committing the baseline

First run with `--update-snapshots` to create the baseline:

```bash
GREP_TAGS="@visual+-@prime+-@noVai+-@needsInfra" \
  docker compose run --rm tests sh -c "npx playwright test path/to/spec.ts --update-snapshots"
```

Open the generated PNG and confirm it shows the page you expected, **not** a loading
spinner or an error state. Commit the PNG alongside the spec change.

Run a second time without `--update-snapshots` to confirm stability before you push.

### Tolerance

Global defaults in `playwright.config.ts` are `maxDiffPixelRatio: 0.03` (3%) and
`threshold: 0.3` (per-pixel YIQ tolerance). The 3% pixel ratio absorbs side-nav badge
drift, transient banners, and minor padding shifts; the 0.3 YIQ threshold absorbs
font-rendering churn between baseline-capture and run-time browsers. Real regressions
still surface — a missing button or misrendered list typically hits double-digit
pixel ratios.

Prefer adding a mask helper to the relevant PO (or use the existing
`chromeMasks(page)` from `@/support/utils/visual-snapshot`, which bundles masthead +
side-nav badge + dynamic-banner masks for full-page snapshots) over loosening the
ratio further — every fix that bumps the ratio makes future regressions easier to
miss.

```typescript
import { visualSnapshot, chromeMasks, ensureLightTheme } from '@/support/utils/visual-snapshot';

test('home page snapshot', async ({ page, rancherApi, isPrime }) => {
  const restoreTheme = await ensureLightTheme(rancherApi);

  try {
    // ... navigate and stabilise ...
    await expect(page).toHaveScreenshot(visualSnapshot(isPrime, 'home.png'), {
      fullPage: true,
      mask: chromeMasks(page),
    });
  } finally {
    await restoreTheme();
  }
});
```

> Operating notes (running, regenerating, GREP filter) live in
> [RUNNING-TESTS.md §7](./RUNNING-TESTS.md#7-visual-snapshot-tests). Rationale and
> conventions live in [UPSTREAM-DIVERGENCES.md §6](./UPSTREAM-DIVERGENCES.md#6-visual-snapshots-percy--playwright).

---

## 9. Checklist Before You Commit

Run through this before pushing:

- [ ] Test passes when run alone: `npx playwright test my-test.spec.ts --reporter=line`
- [ ] Test passes on a second run (idempotent — no leftover resources)
- [ ] No raw CSS selectors in the spec file — all selectors live in POs
- [ ] No `expect()` calls inside Page Objects — POs expose Locators (or return `Response` from action helpers), specs assert
- [ ] No empty `catch` blocks anywhere (`} catch {}`, `.catch(() => {})`) — log + continue with `console.warn`, or rely on `failOnStatusCode = false` on idempotent cleanup
- [ ] No `page.waitForTimeout(N)` in specs; PO sleeps go through `@/support/utils/debounce` helpers
- [ ] Every resource created is cleaned up (`try/finally` or `afterEach`)
- [ ] All assertions use `await expect(...)` (web-first, auto-retrying)
- [ ] Tags match the feature area (`@generic`, `@explorer`, `@fleet`, etc.)
- [ ] Linting passes: `npx eslint e2e/tests/my-test.spec.ts`

---

## 10. Developer Tools

These save time. Use them instead of doing things by hand.

```bash
yarn po-index            # List all POs with class, selector, and methods
yarn po-diff             # Compare POs against upstream Cypress
yarn gap-map             # Generate assertion gap map (upstream vs ours)
yarn summarize-failures  # Classify test failures after a run
```

See also: [Debugging Failures](DEBUGGING-FAILURES.md) for how to use `summarize-failures` and trace analysis.

---

## Quick Reference

| What you want to do | How to do it |
|---|---|
| Import test utilities | `import { test, expect } from '@/support/fixtures'` |
| Log in | `await login()` in `beforeEach` |
| Navigate to a page | `await myPage.goTo()` |
| Find an element | `myPage.someElement()` → returns a `Locator` |
| Assert visibility | `await expect(locator).toBeVisible()` |
| Assert text content | `await expect(locator).toContainText('text')` |
| Assert not in DOM | `await expect(locator).not.toBeAttached()` |
| Wait for API response | `const r = page.waitForResponse(...)` → action → `await r` |
| Mock an API response | `page.route(url, route => route.fulfill({ json }))` |
| Create via API | `await rancherApi.createNamespace(name)` (or `createNamespaceInProject(name, projectId)`) |
| Delete via API | `await rancherApi.deleteNamespace([name])` (array) or `deleteRancherResource('v1', resourceType, id, false)` |
| Skip if no creds | `test.skip(!envMeta.awsAccessKey, 'reason')` |
| Run one test | `npx playwright test my.spec.ts --reporter=line` |
| Debug visually | `npx playwright test my.spec.ts --debug` |
