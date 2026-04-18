# Rancher Dashboard E2E — Playwright

Playwright E2E test suite for [Rancher Dashboard](https://github.com/rancher/dashboard), migrated from the upstream Cypress suite.

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

## Developer Tools

```bash
yarn po-index            # Regenerate PO index
yarn po-diff             # Compare POs against upstream Cypress
yarn gap-map             # Generate assertion gap map
yarn summarize-failures  # Classify test failures after a run
```

## License

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
