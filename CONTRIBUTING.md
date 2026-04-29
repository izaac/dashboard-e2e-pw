# Contributing

Thanks for helping improve the Rancher Dashboard E2E suite. Here's what you need to know — follow
this guide and your PR will have a smooth ride.

## Getting Started

Full setup details are in [`docs/RUNNING-TESTS.md`](docs/RUNNING-TESTS.md). Quick version:

```bash
git clone https://github.com/izaac/dashboard-e2e-pw.git
cd dashboard-e2e-pw
yarn install
npx playwright install chromium
cp .env.example .env
# Edit .env — see docs/RUNNING-TESTS.md for details
```

You need a running Rancher instance. Set `TEST_BASE_URL` and `TEST_PASSWORD` in `.env`.

## Development Workflow

1. Create a branch from `main`
2. Make your changes
3. Run the affected spec:

   ```bash
   npx playwright test e2e/tests/your-spec.spec.ts --reporter=line
   ```

4. Run it a second time — this verifies idempotency
5. Lint and type check:

   ```bash
   yarn lint
   yarn typecheck
   ```

6. Commit and push (ESLint + Prettier run automatically on staged `.ts` files via husky)
7. Open a PR and fill out the [template](.github/pull_request_template.md)

## Test Rules

These are non-negotiable. See [`docs/WRITING-TESTS.md`](docs/WRITING-TESTS.md) for the full explanation.

1. **Atomic** — every test stands alone with no order dependencies. Set up preconditions, assert, clean up.
2. **Idempotent** — must produce the same result on run 1 and run 100.
   Use unique names (`Date.now()` suffixes) to avoid collisions.
3. **Cleanup** — every resource you create gets deleted. Use `try/finally` so cleanup runs even on assertion failure.
4. **No raw selectors in specs** — all selectors live in Page Objects. Specs import POs and call methods.
5. **Web-first assertions** — use `await expect(loc).toBeVisible()`, never
   `expect(await loc.isVisible()).toBe(true)`. Web-first assertions auto-retry.
6. **Import from fixtures** — always `import { test, expect } from '@/support/fixtures'`, not from `@playwright/test`.

## Page Object Conventions

- Component POs extend `ComponentPo`, page POs extend `PagePo`
- Match upstream Cypress PO class names, method names, and selectors
- `self()` returns the root `Locator`
- Methods that find elements return `Locator`; methods that perform actions are `async`
- **POs never assert** — no `expect()` inside Page Objects. POs expose Locators and perform
  actions; specs own all assertions. Exception: `waitFor*` helpers that check visibility as a
  precondition (not a test assertion)
- Check [`e2e/po/INDEX.md`](e2e/po/INDEX.md) before creating a new PO — it lists every existing PO
- Run `yarn po-diff` to compare your POs against upstream Cypress

## Tags

Every test needs at least:

- A **user tag**: `@adminUser`, `@standardUser`, `@standardUserProject`, or `@standardUserSetup`
- A **feature tag**: `@generic`, `@explorer`, `@navigation`, `@fleet`, `@charts`, `@provisioning`, etc.

See [`docs/RUNNING-TESTS.md`](docs/RUNNING-TESTS.md) for the full tag reference.

## Parallelism Classification

All tests run against a shared Rancher instance. Incorrect classification causes flaky failures.

- **Serial**: spec mutates global state (settings, features, extensions, auth providers, drivers)
- **Parallel**: spec only creates namespaced resources or is read-only

Update [`docs/PARALLELISM.md`](docs/PARALLELISM.md) when adding new specs. When in doubt, classify as serial.

## Required Checks Before Submitting

```bash
# 1. Run your spec
npx playwright test e2e/tests/your-spec.spec.ts --reporter=line

# 2. Run it again (idempotency check)
npx playwright test e2e/tests/your-spec.spec.ts --reporter=line

# 3. Lint (also runs automatically on commit)
yarn lint

# 4. Type check
yarn typecheck
```

All four must pass before opening a PR.

## Commit Messages

- Clear, descriptive messages explaining what changed and why
- No conventional commit prefixes required
- Reference issue numbers when applicable (`Fixes #42`)

## Reporting Issues

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md). Include:

- Spec path and test name
- Failure type (timeout, selector, assertion, API error)
- Rancher version
- Error output or failure summary

Run `yarn summarize-failures` after a failed test run to generate a structured failure report.
See [`docs/DEBUGGING-FAILURES.md`](docs/DEBUGGING-FAILURES.md) for detailed guidance on
collecting and analyzing failure artifacts.

## Questions?

- Check existing docs first: [RUNNING-TESTS](docs/RUNNING-TESTS.md), [WRITING-TESTS](docs/WRITING-TESTS.md), [DEBUGGING-FAILURES](docs/DEBUGGING-FAILURES.md)
- Open an issue if the docs don't cover your question

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
