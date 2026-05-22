# TODO

> Last upstream sync check: 2026-05-22

## Upstream Sync Status

**Local repo synced up to:** upstream commit `f5e49a55` (Apr 30, 2026) via local
commit `b07a64e` ("Sync upstream: Microsoft Entra ID rebrand + local cluster edit
accordion check").

### Upstream commits since last sync (May 1 – May 19) — reviewed, none need porting

| Date | Commit | Author | Verdict |
|------|--------|--------|---------|
| May 15 | `3737f3f8` | richard-cox | PO adds `mockListRequests`/`supplementListRequests` — unmerged `mgmt-to-prov` feature branch, not on master yet |
| May 13 | `94d65b5c` | richard-cox | 1-line fix in `v2prov-capi.spec` — same unmerged branch |
| May 12 | `82361f03` | richard-cox | Blueprint mock tweak + cluster-list state text — same unmerged branch |
| May 6 | `2faefe0c` | yonasberhe23 | Cluster tools: resource polling refactor — Cypress-specific hardening, we already handle via `rancherApi` + `waitForResponse` |
| May 5 | `55da6031` | aalves08 | Remove extensions compatibility tests — just deletions, nothing to port |
| May 4 | `3c1e37a7` | IsaSih | Flexibilize release notes assertions for prime — test hardening only |

### Watch list

- [x] **`mgmt-to-prov` branch** (richard-cox) — merged to master as `rancher/dashboard`
  PR #17228. Ported the coverage: `clusterMgmtDigitalOceanSingleResponse` blueprint +
  mgmt-cluster mock in `cloud-credential.spec.ts`; `cluster-prov-select-credential`
  testid in the cluster create/edit POs. Note for future cluster-mock ports: the
  dashboard now loads clusters by id via server-side-pagination
  `?filter=id IN (fleet-default/<name>)` queries — `page.route` patterns must be
  RegExps, not globs, since a glob `*` cannot cross the `/` in a namespaced id.

## Gap-map false positives (covered, just renamed)

`docs/ASSERTION-GAP-MAP.md` matches by exact upstream test name. The following
upstream tests appear under "Missing" but are actually covered with different
names — leave them off the work queue:

- `validating repositories page with percy` → ported as `repositories list page matches snapshot` (visual)
- `should display cluster manager page` → ported as `cluster manager list page matches snapshot` (visual)
- `validating machine deployments page with percy` → ported as `machine deployments page matches snapshot` (visual)
- `validating empty machine sets page with percy` → ported as `empty machine sets page matches snapshot` (visual)
- `should display machines list page` → ported as `machines list page matches snapshot` (visual)
- `should display kontainer drivers list page` → ported as `kontainer drivers list page matches snapshot` (visual)
- `should display continuous delivery page git repo` → ported as `git repo list page matches snapshot` (visual)
- `Validate home page with percy` → ported as `home page matches snapshot` (visual)
- `should create a new pod` / `…folder` / `…validate folder name` / `…delete folder` (4 tests in `websockets/connection.spec.ts`) → consolidated into the single end-to-end test `should create a pod and manage folders via WebSocket exec`

## Empty stub tests

Tests with empty bodies, marked `// eslint-disable-next-line playwright/expect-expect -- stub body never runs`. Implementation needed once blockers below are resolved.

### Need provisioning infrastructure (downstream / RKE2 / imported clusters)

- [ ] `cluster-manager.spec.ts` (11) — create/edit/copy/yaml/kubeconfig/download/delete on RKE2 custom + imported clusters; one display test
- [ ] `fleet-clusters.spec.ts` (10) — list/details, bundle add/remove, pause/unpause, edit, download, workspace assign, delete
- [ ] `gitrepo.spec.ts` (1) — `Can create a GitRepo` (needs real fleet multi-cluster)

### Need third-party auth provider

- [ ] `project-namespace.spec.ts` (1) — creator principal id annotation when creating project via third-party auth

### Headless limitation

- [ ] `pods.spec.ts` (1) — Footer controls stick to bottom in YAML editor (viewport measurement not available headless)

### Known upstream bugs / Vue3 migration

- [ ] `jwt-authentication.spec.ts` (2) — bulk enable/disable JWT (websocket bug, `test.fixme`)
- [ ] `agent-configuration-rke2.spec.ts` (1) — placeholder, Vue3 skip upstream
- [ ] `node-drivers.spec.ts` (1) — placeholder (upstream rancher/dashboard#10275)
- [ ] `pod-security-policy-templates.spec.ts` (1) — placeholder (upstream rancher/dashboard#10187)

### Form blocked by upstream bug

- [ ] `project-secrets.spec.ts` — `creates a project-scoped secret` is `test.fixme`. Save stays disabled because v2.15-head projects no longer expose `status.backingNamespace` (read by `shell/edit/secret/index.vue`). Title test passes. See `DEBUGGING-FAILURES.md`.

## Assertion Parity Gaps

### Systemic patterns

- [ ] `custom-resource-definitions.spec.ts` — sequential run causes API server stress

## CI / Infra

- [ ] Qase IDs — to be mapped manually by QA
- [ ] Jenkins job for Playwright pipeline (Jenkinsfile in qa-infra-automation)

## Upstream advocacy

- [ ] Push upstream rancher/dashboard to migrate
  `shell/components/SortableTable/paging.js` (and its `debug.js` sibling) to
  TypeScript. Last legacy `.js` files in an otherwise mostly-TS component
  tree; surfaced while debugging the CRD pagination test.

## Known chronic flakes — needs deeper investigation

- [ ] **`harvester.spec.ts:108 can auto install harvester`** — fails 3/5 even with the
  current install-flow hardening (page reload after API deployed → navigate to
  /uiplugins#installed → click `extension-reload-banner` if shown → 3-reload
  retry loop with LONG waits). The harvester extension's masthead action
  ("Import Existing") is provided by Vue components registered when the
  extension JS bundle loads; on some Rancher instances the SPA never
  re-registers the plugin after install, so the action button never appears
  no matter how many reloads. Likely a Rancher dashboard plugin-loader race
  we cannot fix without changing the SPA. Options:
  - Accept the flake (current state — retries mask it most of the time);
  - Convert to `test.skip(buttonNotVisible, 'env-level plugin loader race')`;
  - Refactor to test only the API path + extension card visibility, drop
    the cluster-import UI portion.

## Gold-standard audit (Phase 4 + long tail) — revisit after a full sharded suite run

Phase 1, 2, 3 and the documentation parts of Phase 5 are closed (see
`docs/AUDIT-PLAYWRIGHT-GOLDEN-STANDARD-2026-05-04.md`). Remaining items
intentionally deferred until we have results from a fresh sharded full-suite
run — that surfaces which serial groups are actually expensive and which
specs would benefit most from per-worker isolation:

- [ ] **Phase 4 — Parallel-safe lane foundation**
  - [ ] Generate `PARALLELISM.md` from a script (gap-map / po-index style); fail CI on unclassified specs (audit finding #6).
  - [ ] Split serial-global vs parallel-safe Playwright projects.
  - [ ] Per-worker users / storage state for `fullyParallel: true` lanes (F7 unblocked the auth-slug side; user creation is still open).
  - [ ] Namescope created resources by worker/test to avoid server-side collisions.
- [ ] **Long tail (touch as helpers are touched)**
  - [ ] 284 raw class/id locators in POs — track selector type in the PO index, push for upstream `data-testid` attributes on high-value sites.
  - [ ] 214 `any` usages across `e2e/` + `support/` — start with `support/fixtures/rancher-api.ts`, narrow types as helpers are touched.
- [ ] **Phase 5 — docs as executable policy**
  - [ ] Snippet type-check step for `WRITING-TESTS.md` examples (would need a docs lint that compiles TS snippets against real types).
  - [ ] Diff `AGENTS.md` against `WRITING-TESTS.md` + `CONTRIBUTING.md` + lint rules to confirm they say the same thing.
