# Why Our Playwright Port Is Better Than Upstream Cypress

A plain-English comparison for anyone — no deep framework knowledge needed.

---

## The One-Sentence Summary

Upstream Cypress tests are **chained together like dominoes** — if one falls wrong, they all
break. Our Playwright tests are **independent bricks** — each one stands on its own.

---

## Side-by-Side Comparison

| Area | Upstream (Cypress) | Ours (Playwright) |
|------|-------------------|-------------------|
| **Test independence** | Tests share browser state. Test 3 assumes test 1 and 2 already ran. | Every test starts fresh. Run any test alone — it works. |
| **When a test crashes** | Later tests in the same block break because they expected the previous test to set things up. | Other tests are unaffected. Each one sets up its own world. |
| **Cleanup** | Relies on the *next* test to reset state. If a test crashes, resources leak. | Every test cleans up after itself with `try/finally`. If it crashes, the next run catches leaked resources automatically. |
| **Speed** | Cypress queues commands one-by-one with built-in waits between them. | Playwright runs as fast as the browser allows — no artificial slowdowns. |
| **Flakiness from timing** | Cypress is *accidentally* slow enough to avoid Vue debounce bugs. If Cypress gets faster, those tests break. | We handle debounce explicitly. We know *why* we wait. |
| **Visual testing** | Requires Percy (paid cloud service + token + separate CLI). | Built into Playwright. Screenshots stored in the repo. No external service needed. |
| **Parallelism** | Hard to parallelize because tests depend on each other's state. | Easy to parallelize because every test is self-contained. |
| **Debugging failures** | Read raw logs and screenshots manually. | Run `yarn summarize-failures` — get a classified summary instantly. |
| **Network assertions** | `cy.intercept` + aliases with implicit timing magic. | Explicit `waitForResponse` — you see exactly what's being waited on and why. |
| **Developer tooling** | Manual comparison between specs and page objects. | `yarn gap-map`, `yarn po-diff`, `yarn po-index` — automated project health checks. |

---

## What Does "Independent Tests" Actually Mean?

Imagine you're testing a recipe app:

**Upstream approach (Cypress):**

1. Test A: Create a recipe
2. Test B: Edit that recipe (assumes Test A already created it)
3. Test C: Delete that recipe (assumes Test B already edited it)

If Test A breaks, Tests B and C *also* fail — even though editing and deleting might work fine.
You get 3 failures to investigate when only 1 thing is actually wrong.

**Our approach (Playwright):**

1. Test A: Create a recipe → verify → delete it
2. Test B: Create a recipe via API → edit it → verify → delete it
3. Test C: Create a recipe via API → delete it → verify it's gone

Each test handles its own setup and cleanup. If Test A breaks, Tests B and C still pass. You
know immediately that "create" is the *only* broken thing.

---

## What Does "Idempotent" Mean?

It means: **run it any number of times, in any order, and it works.**

- Run test B first? Works.
- Run test C ten times in a row? Works.
- Server was left dirty by a crashed test an hour ago? Works (catches the leftover on next run).

Upstream tests don't have this. If you re-run a failed Cypress test without resetting the
entire server, it often fails differently because it expects a clean starting state that only
exists at the beginning of the full suite.

---

## What Does "Web-First Assertions" Mean?

When checking if something is visible on screen:

**Old way (fragile):**

```
Check if button is visible RIGHT NOW → yes/no
```

If the page was still loading, you get "no" and the test fails — even though the button
would appear 100ms later.

**Our way (smart):**

```
Keep checking if button is visible for up to 5 seconds → yes/no
```

Playwright automatically retries until the condition is true or the timeout expires. This
eliminates most "flaky" failures caused by pages loading at slightly different speeds.

---

## What Does "No Selectors in Spec Files" Mean?

A **selector** is the code that finds a button or input on the page (like
`[data-testid="save-button"]` or `.header .title`).

**Upstream pattern:** Selectors are scattered throughout test files. If the UI team renames a
button's `data-testid`, you hunt through dozens of test files to update it.

**Our pattern:** Selectors live *only* in Page Objects (PO files). The test says
`await saveBanner.save()` — the Page Object knows *how* to find the save button. If the
selector changes, you update one file.

---

## Real-World Benefits

### For QA Engineers

- **Faster failure diagnosis** — one broken test means one broken thing, not a cascade
- **Easier to write new tests** — just set up, assert, clean up. No worrying about test order
- **Safer to run subsets** — tag filtering (`@generic`, `@explorer`) always works because tests
  are independent

### For CI/CD

- **Parallelizable** — split tests across machines without worrying about ordering
- **Retry-friendly** — a failed test can be retried alone without re-running the whole suite
- **No mystery failures** — if it passes locally, it passes in CI (same behavior everywhere)

### For the Team

- **Lower maintenance** — UI changes only need Page Object updates, not test rewrites
- **Built-in tooling** — gap maps, PO diffs, and failure summaries keep the suite healthy
  without manual bookkeeping
- **No vendor lock-in** — no paid services required. Everything runs locally or in any CI system

---

## Summary

| Quality | Upstream | Ours |
|---------|----------|------|
| Can run one test alone | ❌ Often breaks | ✅ Always works |
| Can retry a failed test | ❌ May fail differently | ✅ Same result every time |
| Can run in parallel | ❌ Ordering dependencies | ✅ Fully independent |
| Handles crashes cleanly | ❌ Leaks resources | ✅ Auto-cleans on next run |
| Free from paid services | ❌ Percy for visual tests | ✅ All built-in |
| Easy to find what broke | ❌ Cascade failures | ✅ One failure = one problem |

Our port isn't just the same tests in a different framework — it's a fundamentally more
reliable, maintainable, and developer-friendly test suite.
