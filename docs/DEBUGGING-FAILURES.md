# Debugging Test Failures

Your test failed — here's how to figure out why and fix it. This guide walks through the tools,
artifacts, and patterns you'll use most.

For running tests, see [RUNNING-TESTS.md](./RUNNING-TESTS.md).
For writing tests, see [WRITING-TESTS.md](./WRITING-TESTS.md).

---

## Table of Contents

1. [Test Failed, Now What?](#1-test-failed-now-what)
2. [Quick Workflow](#2-quick-workflow)
3. [Understanding Artifacts](#3-understanding-artifacts)
4. [Failure Type Playbook](#4-failure-type-playbook)
5. [Reproduction Ladder](#5-reproduction-ladder)
6. [Test Bug vs App Bug vs Environment Issue](#6-test-bug-vs-app-bug-vs-environment-issue)
7. [Common Failure Patterns](#7-common-failure-patterns)
8. [What to Include in a Bug Report](#8-what-to-include-in-a-bug-report)

---

## 1. Test Failed, Now What?

Debug in this order. Each step narrows the problem — don't skip ahead.

1. **Run `yarn summarize-failures`** and read `test-results/FAILURE-SUMMARY.md`.
   The summary classifies every failure, cross-references network errors, and
   flags DOM state issues. This alone tells you what kind of problem you have.

2. **Open the HTML report** (`npx playwright show-report`).
   Click into the failing test. Artifacts (screenshot, trace, video) are
   attached inline.

3. **Check the screenshot.** What was the page showing at the moment of failure?
   Wrong page? Spinner? Login redirect? Error banner? This is the fastest
   visual signal.

4. **Open the trace.** Step through every action the test took: clicks, network
   requests, DOM snapshots, locator resolution. This is your primary deep-debug
   tool.

5. **Re-run the test headed or in debug mode** to reproduce the failure live.
   Use `--headed` to watch, `--debug` to pause on each step.

---

## 2. Quick Workflow

Copy-paste these commands. Replace `<spec>` and `<test name>` with your values.

```bash
# Re-run the failing test
npx playwright test <spec> -g "<test name>" --reporter=line

# Summarize all failures
yarn summarize-failures
cat test-results/FAILURE-SUMMARY.md

# Open interactive report
npx playwright show-report

# Re-run visually
npx playwright test <spec> -g "<test name>" --headed

# Step through interactively
npx playwright test <spec> -g "<test name>" --debug

# Open a specific trace file
npx playwright show-trace test-results/<test-dir>/trace.zip

# Visual interactive runner (pick tests, see traces inline)
npx playwright test --ui
```

---

## 3. Understanding Artifacts

Every failed test produces artifacts in `test-results/<test-dir>/`. The project
is configured to retain traces, screenshots, and videos on failure automatically
(see `playwright.config.ts`).

| Artifact | Location | What it tells you | When to use |
|----------|----------|-------------------|-------------|
| **Failure summary** | `test-results/FAILURE-SUMMARY.md` | Classified failure type, network error cross-refs, DOM state flags | Always first — before touching anything else |
| **Screenshot** | `test-results/<test-dir>/test-failed-*.png` | What was on screen at the exact moment of failure | Quick visual triage: wrong page? spinner? login? |
| **Trace** | `test-results/<test-dir>/trace.zip` | Step-by-step timeline: every action, network request, DOM snapshot, locator highlight | Primary deep-debug tool — use for any non-obvious failure |
| **Video** | `test-results/<test-dir>/video.webm` | Full recording of the browser session | Race conditions, animation issues, transition bugs |
| **HTML report** | `playwright-report/index.html` | All tests + all artifacts in one browsable UI | Comparing multiple failures, sharing with teammates |

### How to read a trace

Open with `npx playwright show-trace test-results/<test-dir>/trace.zip`
or click "Traces" in the HTML report.

The trace viewer has four panels:

- **Timeline** — every test action in order; click to jump
- **DOM snapshot** — the page at that moment; inspect elements
- **Network** — requests/responses; check status codes and payloads
- **Console** — browser console logs and errors

Look for:

- The last successful action before the failure
- Network requests that returned errors (red in the network panel)
- DOM state at the failing locator step (was the element there?)

---

## 4. Failure Type Playbook

The failure summary classifies each failure into one of these types.

| Type | What it means | Common causes | What to check first |
|------|--------------|---------------|---------------------|
| **Timeout** | Expected element or response never arrived | Wrong page loaded, selector changed, backend slow, spinner stuck | Screenshot (what page?), trace network tab |
| **Selector** | Locator didn't match anything | PO selector stale, DOM changed, component not rendered yet | Trace DOM snapshot, recent upstream UI changes |
| **Assertion** | Element found but wrong value or state | App bug, race condition, wrong test data assumption | Expected vs actual in trace, check if value appears later |
| **API error** | Backend returned non-2xx | Rancher issue, auth expired, resource conflict (409) | Trace network requests, Rancher server logs |
| **Navigation** | Ended up on wrong page | Redirect, auth expired, bad URL construction (`/path` vs `./path`) | Screenshot (current URL), trace navigation steps |
| **Crash** | Page or browser died | Out of memory, app hard crash, extension conflict | stderr output, retry behavior, system resource usage |

### Decision tree by failure type

**Timeout →** Check screenshot. If the page is blank or shows a spinner, it's
likely a backend issue. If the page looks correct but the element is missing,
the selector may have changed. Check the trace network tab for slow or failed
requests.

**Selector →** Open the trace DOM snapshot at the failing step. Search for the
expected `data-testid` or class. If it's gone, the upstream UI changed. If it's
inside a different parent, the PO needs to scope its locator.

**Assertion →** The element exists but has the wrong content. Compare expected vs
actual in the test output. Open the trace to see if the correct value appears
later (race condition) or never appears (app bug).

**API error →** Check the status code. 401/403 = auth problem. 404 = resource
doesn't exist (test cleanup issue). 409 = conflict (resource already exists).
500 = backend bug.

**Navigation →** Check the URL in the screenshot. If you're on the login page,
the session expired. If the URL path is wrong, check whether the PO uses
`./path` (correct) or `/path` (wrong — bypasses `baseURL` prefix).

---

## 5. Reproduction Ladder

Use the lightest tool that answers your question. Escalate only when needed.

### Re-run one test

```bash
npx playwright test <spec> -g "<test name>" --reporter=line
```

**When:** Always start here. Confirms the failure is reproducible and not a
one-off flake. If it passes on retry, you likely have a race condition or
test isolation issue.

### `--headed` mode

```bash
npx playwright test <spec> -g "<test name>" --headed
```

**When:** You don't understand what the test is doing. Watching the browser
reveals surprising behavior: wrong page, unexpected modal, slow loading.
The test runs at full speed — blink and you'll miss it.

### `--debug` mode

```bash
npx playwright test <spec> -g "<test name>" --debug
```

**When:** You need to pause on each step and inspect the live DOM. The
Playwright Inspector opens alongside the browser. You can:

- Step through actions one at a time
- Inspect the current DOM with browser DevTools
- Evaluate locators in the Inspector console
- See which element each locator resolves to

Best for timing issues, locator debugging, and understanding action order.

### `--ui` mode

```bash
npx playwright test --ui
```

**When:** You're iterating on a fix and want to re-run tests repeatedly
without switching to the terminal. The UI mode shows:

- All tests in a tree view — click to run
- Inline trace viewer for each run
- Watch mode — re-runs on file change

Best for active development and iterative debugging.

---

## 6. Test Bug vs App Bug vs Environment Issue

Not every failure is a test bug. Use these heuristics to classify the root
cause before you start fixing.

| Clue | Likely cause |
|------|-------------|
| Login page visible in screenshot | Auth/session expired, environment misconfigured |
| Selector not found but page looks correct | PO selector outdated, upstream UI changed |
| API 500 in network trace | Rancher backend bug — check server logs |
| Works locally, fails in CI | Timing difference, resource constraints, network latency |
| Passes on retry | Flaky — race condition or test isolation issue |
| Spinner or loading indicator never clears | Backend slow or hung, websocket disconnected |
| Wrong URL in screenshot | Navigation bug, redirect, or incorrect URL construction |
| Test passes alone but fails in suite | Shared state leak — previous test didn't clean up |
| Different results with `--headed` vs headless | Viewport size difference or animation timing |

### What to do for each

- **Test bug:** Fix the test. Update the selector, add proper waits, fix
  cleanup logic.
- **App bug:** File an issue against
  [rancher/dashboard](https://github.com/rancher/dashboard). Include the
  trace and screenshot. Skip the test with a link to the issue.
- **Environment issue:** Check Rancher health, credentials, and connectivity.
  Re-run after fixing the environment — don't change the test.

---

## 7. Common Failure Patterns

Patterns specific to this project and the Rancher Dashboard.

### Spinner never disappears

The backend is still reconciling a resource. The test waited for the page to
load, but a loading indicator never cleared.

**Fix:** The test or PO may need a longer timeout for `waitForRancherResource`,
or the backend is genuinely hung. Check the Rancher server logs and pod status.

### Save clicked but API request never fired

The Vue component debounces `$emit('update:value')` (typically 500ms).
Playwright is fast enough to click Save before the debounce fires. The form
values are visible in the DOM but missing from the submitted request body.

**Fix:** Call the PO's `waitFor*Debounce()` method before clicking Save.
See the [Rancher Vue Debounce Traps](./WRITING-TESTS.md) section in the
writing guide.

### Redirected back to login

The session cookie expired between test steps. This happens when a test takes
too long or when the Rancher auth token has a short TTL.

**Fix:** Check if the test is doing too much setup before the action. Consider
using `rancherApi` for setup instead of navigating through the UI.

### Modal or toast blocking a click

An overlay (confirmation dialog, success toast, error banner) is still visible
when the test tries to click the next element.

**Fix:** Dismiss the overlay first, or wait for it to auto-dismiss. Check if
the PO has a `closeToast()` or `dismissModal()` method.

### "strict mode violation — resolved to 2 elements"

Playwright's strict mode means a locator must resolve to exactly one element.
Two elements matched the same `data-testid`, usually from sibling components
rendering the same sub-component.

**Fix:** Scope the locator to a parent container. In the PO, use
`this.self().getByTestId('x')` instead of `page.getByTestId('x')`.

### Stale PO selector after upstream update

The upstream Rancher Dashboard changed a `data-testid`, class name, or
component structure. The PO's selector no longer matches.

**Fix:** Run `yarn po-diff` and check `e2e/po/UPSTREAM-DIFF.md` for
discrepancies. Update the PO to match the current upstream selectors.

---

## 8. What to Include in a Bug Report

Whether you're filing a test bug or an app bug, include these details.

### Required

- **Spec file path and test name** — e.g.,
  `e2e/tests/pages/explorer/workloads/deployments.spec.ts > "creates a deployment"`
- **Failure type** — from the failure summary (timeout, selector, assertion, etc.)
- **Screenshot** — attach or paste the path:
  `test-results/creates-a-deployment/test-failed-1.png`
- **Trace file** — attach or paste the path:
  `test-results/creates-a-deployment/trace.zip`
- **Rancher version:**

  ```bash
  curl -sk https://<your-rancher>/rancherversion | jq .
  ```

### Helpful extras

- Whether it reproduces in `--headed` or `--debug` mode
- Whether it passes on retry (and how often it fails out of N runs)
- The failure summary classification and any network error cross-references
- Git branch and commit SHA
- Environment details (local vs CI, Docker vs native)

### Template

```markdown
**Test:** `e2e/tests/pages/explorer/workloads/deployments.spec.ts`
**Name:** "creates a deployment"
**Failure type:** Timeout
**Rancher version:** v2.9.1

**What happened:**
Save button clicked but the API request timed out after 30s.

**Artifacts:**
- Screenshot: `test-results/creates-a-deployment/test-failed-1.png`
- Trace: `test-results/creates-a-deployment/trace.zip`

**Reproduces:** Yes, 3/5 runs in headed mode.
**Passes on retry:** Sometimes (2/5).

**Notes:**
Network trace shows the POST to `/v1/apps.deployments` returned 504.
Likely a backend timeout — Rancher logs show high API latency.
```

---

## Further Reading

- [RUNNING-TESTS.md](./RUNNING-TESTS.md) — environment setup and execution
- [WRITING-TESTS.md](./WRITING-TESTS.md) — test authoring, POs, fixtures
- [Playwright docs: Debugging](https://playwright.dev/docs/debug)
- [Playwright docs: Trace Viewer](https://playwright.dev/docs/trace-viewer)
- [Playwright docs: Test Reporter](https://playwright.dev/docs/test-reporters)
