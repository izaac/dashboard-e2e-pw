# TODO

> Last upstream sync check: 2026-05-29

## Upstream Sync Status

**Synced up to:** upstream `6119bf9` (May 22, 2026 — "Stabilize imported generic
cluster e2e spec", PR #17795) plus PR #17228 (mgmt-to-prov). Ported via e2e-pw
`55baf2d` (#17795) and `9ddf09c` (#17228).

**Reviewed through:** `upstream/master` `8eed0d0b` (May 29, 2026).

### Upstream e2e commits since sync — reviewed 2026-05-29

5 commits touch `cypress/e2e` since the sync point:

| Date | Commit | Verdict |
|------|--------|---------|
| May 29 | `0d4c73d` #16797 hosted provider details | **ACTION** — moved provisioning-log test local→RKE2 custom; new `hosted-cluster-details.spec` + mock (see Action items) |
| May 27 | `fe4ea50` #16092 node scheduling | **NEW COVERAGE** — node-scheduling regression test in `workloads.spec` (see Action items) |
| May 28 | `79b5f33` get-support | No action — upstream commented out a flaky cross-origin pricing test (#17869); our PW version only asserts the `href`, so it is not subject to that flake |
| May 26 | `d0b5072` harvester | No port — plain re-enable of auto-install (no new hardening); our `harvester.spec.ts:108` is already active and more hardened |
| May 20 | `db1dd2e` edit-fake-cluster flaky fix | No port — its "expand intercepts" is a Cypress pagesize-split so `cy.wait` can target each; our single regex route + `checkLoadingIndicatorNotVisible()` + Playwright auto-wait already cover it |

### Gap-map note

`docs/ASSERTION-GAP-MAP.md` was stale (generated May 2). Regenerating against master
(2026-05-30) surfaced two older upstream specs previously assumed "no porting needed"
that DO need porting — `configmap-detail-title-bar.spec.ts` (#17645) and
`users-and-auth/last-login-sort.spec.ts`. Both are in Action items below.

### Action items from 2026-05-29 sync review

- [ ] **#16797 (hosted provider details)** — relocate `cluster-manager.spec.ts`
  qase 3227 `can navigate to Cluster Provisioning Log Page` out of the local-cluster
  block (upstream moved it to the RKE2 custom detail context). Re-check detail-tab
  assertions for the broader change (node-pool tabs on eks/aks/gke; autoscaler tab
  hidden; logs tab removed from imported; "show configuration" added to mgmt-node
  allowed actions).
- [ ] **Port `hosted-cluster-details.spec.ts`** (5 tests: node-pool tab on AKS/EKS/GKE,
  no autoscaler tab, no provisioning-log tab on imported) + `cluster-detail-hosted.po`
  - `hosted-cluster-mocks` blueprint (2101 ln — large mock).
- [ ] **Port node-scheduling regression test** (#16092) in `workloads.spec`
  (`should clear nodeName when switching node scheduling back to any node`, qase 48753)
  - `node-scheduling.po`.
- [ ] **Port `configmap-detail-title-bar.spec.ts`** (2 tests: state badge stays adjacent
  to a short / long resource name; #17645).
- [ ] **Port `users-and-auth/last-login-sort.spec.ts`** (1 test: null Last Login sorts
  to bottom descending / top ascending).
- [ ] *Optional:* adopt upstream action-menu PO robustness from `db1dd2e`
  (`getMenuItem` → `contains('[dropdown-menu-item]', name)` + `waitForMenuItem`).

### Durable note (cluster-mock ports)

The dashboard loads clusters by id via server-side-pagination
`?filter=id IN (fleet-default/<name>)` queries — `page.route` patterns must be RegExps,
not globs, since a glob `*` cannot cross the `/` in a namespaced id. (From the PR #17228
mgmt-to-prov port, now merged and ported.)

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
  - **Imported Generic** — `can create new cluster` is wired up end-to-end (registers via `applyImportedKubectlCommand`, cleans up via `rancherApi` in `afterEach`, retries:0). Remaining `test.fixme`s reference `SHARED_IMPORT_GENERIC_NAME` static constant rather than the cluster the create test actually provisions:
    - [ ] `can edit imported cluster and see changes afterwards` — needs shared-state refactor (beforeAll fixture creates one cluster, all 3 tests reuse it, afterAll deletes)
    - [ ] `can delete cluster by bulk actions` — same shared-state refactor
  - **RKE2 Custom** — `can create new cluster` is wired up end-to-end (registers via `registerCustomNode` SSH, cleans up via v1 `provisioning.cattle.io.clusters/fleet-default/<name>` in `afterEach`, retries:0). Remaining `test.fixme`s reference `SHARED_RKE2_CUSTOM_NAME`:
    - [ ] `can copy config to clipboard` — shared cluster + clipboard stub
    - [ ] `can edit cluster and see changes afterwards`
    - [ ] `can view cluster YAML editor`
    - [ ] `can download KubeConfig`
    - [ ] `can download YAML`
    - [ ] `preserves custom addon config values after saving cluster config`
    - [ ] `can delete cluster`
  - Shared blocker: lifecycle model. Pick one of:
    - `beforeAll` per describe block creates cluster, exposes name via closure, `afterAll` deletes. Tests run `mode: 'serial'`.
    - Worker-scoped fixture (`test.extend`) creates cluster once per worker, returns name. Cleaner but adds fixture infra to track.
  - Once that lands, replace `SHARED_*_NAME` constants with the fixture-returned name and drop `test.fixme` on each remaining body.
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

### Form blocked by upstream bug

- [ ] `project-secrets.spec.ts` — `creates a project-scoped secret` is `test.fixme`. Save stays disabled because v2.15-head projects no longer expose `status.backingNamespace` (read by `shell/edit/secret/index.vue`). Title test passes. See `docs/DEBUGGING-FAILURES.md`.

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

- [ ] **Sharded-run timeout failures** — a stable-subset sharded run (`@adminUser`
  minus `@prime`/`@noVai`/`@needsInfra`/`@provisioning`) surfaced 9 failures
  alongside dashboard-side SPA crashes in the browser console (`TypeError:
  Cannot read properties of undefined (reading 'replace')`, `this.$el.querySelector
  is not a function`, etc.). The suite pulls a fresh `rancher:head` each run so
  the set drifts. Triage: re-check each against a pinned upstream tag to separate
  genuine head regressions from flakes, then harden or quarantine. The two
  `home.spec.ts` cases were fixed in `b026592` (checkbox column-offset on the
  Cluster Management list; mgmt-side route for the description mock). Remaining:
  - [ ] `cluster-manager.spec.ts:302 navigate to Cluster Machines Page` — Vue
    `TypeError ... 'replace'` + `this.$el.querySelector is not a function`,
    machine table empty; likely a `head` Vue component crash to file upstream.
  - [ ] `cluster-list.spec.ts:9 can group clusters by namespace` — namespace
    group-row never renders. VAI/server-side-pagination grouping behavior change.
  - [ ] `edit-fake-cluster.spec.ts:19 registry auth retain ID` — action menu on
    `some-fake-cluster-id` lacks `Edit Config` (same locator pattern as the
    cloud-credential bug, but `fake-cluster.ts` already links prov→mgmt; needs
    DOM-snapshot triage).
  - [ ] `edit-fake-cluster.spec.ts:37 doc link new tab` — same `Edit Config`
    menu-missing pattern as above.
  - Note (2026-05-29): upstream `db1dd2e` root-caused this flake as a load race, fixed
    Cypress-side via pagesize-split intercepts + `loadingPo.checkNotExists()`. Our PW
    blueprint already mocks all pagesizes (single regex route) and we wait on the loading
    indicator, so these are likely sharded-run drift, not the mock race — triage as such.
  - [ ] `v2prov-capi.spec.ts:67 no machine provider for CAPI clusters` — TBD,
    artifact not yet triaged.
  - [ ] `preferences.spec.ts:674 login landing page – home page` — PAGE-STILL-LOADING
    at landing-page selection; user-pref-related, may be related to the
    `Error parsing server pref theme SyntaxError` console error.
  - [ ] `roles.spec.ts:282 delete a role template from the detail page` — EMPTY-STATE,
    401 on `ext.cattle.io.selfuser`.

## Gold-standard audit (Phase 4 + long tail)

Phase 1, 2, 3 and the documentation parts of Phase 5 are closed (see
`docs/AUDIT-PLAYWRIGHT-GOLDEN-STANDARD-2026-05-04.md`). Sharded full-suite runs
have now been done — see "Known chronic flakes" above for the timeout findings.
Remaining Phase 4 items below are the follow-up work:

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
