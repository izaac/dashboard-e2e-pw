# Playwright component tests

Component tests for dashboard SFCs, kept separate from the e2e suite. They mount
real components in a Vite build (`@playwright/experimental-ct-vue`) and need no
cluster, no muster, no auth, and no `playwright.config.ts` changes.

## Requirements

- A rancher/dashboard checkout, resolved from `DASHBOARD_ROOT`. The default is
  `../dashboard` relative to this repo.
- The devshell (`devenv shell` or `nix develop`), which provides system Chromium.
  On other platforms Playwright's bundled Chromium is used.

## Run

```bash
npx playwright test -c playwright-ct.config.ts
```

With a dashboard checkout somewhere else:

```bash
DASHBOARD_ROOT=/code/dashboard npx playwright test -c playwright-ct.config.ts
```

Filter by file or test name:

```bash
npx playwright test -c playwright-ct.config.ts labeled-select-options
npx playwright test -c playwright-ct.config.ts --grep "falsy"
```

## Layout

- `playwright-ct.config.ts` — CT config: aliases, SCSS globals, dedupe, port 3100.
- `playwright/index.ts` — `beforeMount` globals: vuex store (`i18n/t`), global
  `v-select` registration, `t` component stub.
- `playwright/index.html` — CT page template.
- `playwright/vars.scss` — pulls in the dashboard global SCSS and backfills
  `$icon-size`, which only exists in the app entrypoint.
- `component-tests/*.spec.ts` — the specs.

## Notes

- Component tests are excluded from `tsconfig.json`, so `yarn typecheck` keeps
  covering only the e2e sources.
- The e2e config uses `testMatch` under `e2e/tests/`, so these specs are never
  collected by `playwright.config.ts`.
- Specs must import from the dashboard via the aliases (`@shell/...`,
  `@components/...`), not with relative paths outside this repo.
- `playwright/.cache` and `component-tests/test-results` are generated and
  ignored. If you delete or rename a spec, clear `playwright/.cache`; the Vite
  cache can otherwise keep pointing at the removed file.
