# TODO

> Last upstream sync check: 2026-05-22

## Upstream Sync Status

**Local repo synced up to:** upstream commit `f5e49a55` (Apr 30, 2026) via local
commit `b07a64e` ("Sync upstream: Microsoft Entra ID rebrand + local cluster edit
accordion check").

### Upstream commits since last sync (May 1 – May 19), reviewed

The `mgmt-to-prov` commits below merged to master as PR #17228 and have been
ported (see Watch list); the rest need no porting.

| Date | Commit | Author | Verdict |
|------|--------|--------|---------|
| May 15 | `3737f3f8` | richard-cox | `mgmt-to-prov` PO helpers, merged as #17228, ported |
| May 13 | `94d65b5c` | richard-cox | `mgmt-to-prov` `v2prov-capi.spec` fix, merged as #17228, ported |
| May 12 | `82361f03` | richard-cox | `mgmt-to-prov` blueprint + cluster-list text, merged as #17228, ported |
| May 6 | `2faefe0c` | yonasberhe23 | Cluster tools: resource polling refactor: Cypress-specific hardening, we already handle via `rancherApi` + `waitForResponse` |
| May 5 | `55da6031` | aalves08 | Remove extensions compatibility tests, just deletions, nothing to port |
| May 4 | `3c1e37a7` | IsaSih | Flexibilize release notes assertions for prime, test hardening only |

### Watch list

- [x] **`mgmt-to-prov` branch** (richard-cox), merged to master as `rancher/dashboard`
  PR #17228. Ported the coverage: `clusterMgmtDigitalOceanSingleResponse` blueprint +
  mgmt-cluster mock in `cloud-credential.spec.ts`; `cluster-prov-select-credential`
  testid in the cluster create/edit POs. Note for future cluster-mock ports: the
  dashboard now loads clusters by id via server-side-pagination
  `?filter=id IN (fleet-default/<name>)` queries: `page.route` patterns must be
  RegExps, not globs, since a glob `*` cannot cross the `/` in a namespaced id.

## Gap-map false positives (covered, just renamed)

`docs/ASSERTION-GAP-MAP.md` matches by exact upstream test name. The following
upstream tests appear under "Missing" but are actually covered with different
names, so leave them off the work queue:

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

- [ ] `cluster-manager.spec.ts` (11): create/edit/copy/yaml/kubeconfig/download/delete on RKE2 custom + imported clusters; one display test
  - **Imported Generic**: `can create new cluster` is wired up end-to-end (registers via `applyImportedKubectlCommand`, cleans up via `rancherApi` in `afterEach`, retries:0). Remaining `test.fixme`s reference `SHARED_IMPORT_GENERIC_NAME` static constant rather than the cluster the create test actually provisions:
    - [ ] `can edit imported cluster and see changes afterwards`, needs shared-state refactor (beforeAll fixture creates one cluster, all 3 tests reuse it, afterAll deletes)
    - [ ] `can delete cluster by bulk actions`, same shared-state refactor
  - **RKE2 Custom**: `can create new cluster` is wired up end-to-end (registers via `registerCustomNode` SSH, cleans up via v1 `provisioning.cattle.io.clusters/fleet-default/<name>` in `afterEach`, retries:0). Remaining `test.fixme`s reference `SHARED_RKE2_CUSTOM_NAME`:
    - [ ] `can copy config to clipboard`, shared cluster + clipboard stub
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
- [ ] `fleet-clusters.spec.ts` (10): list/details, bundle add/remove, pause/unpause, edit, download, workspace assign, delete
- [ ] `gitrepo.spec.ts` (1): `Can create a GitRepo` (needs real fleet multi-cluster)

### Need third-party auth provider

- [ ] `project-namespace.spec.ts` (1): creator principal id annotation when creating project via third-party auth

### Headless limitation

- [ ] `pods.spec.ts` (1): Footer controls stick to bottom in YAML editor (viewport measurement not available headless)

### Known upstream bugs / Vue3 migration

- [ ] `jwt-authentication.spec.ts` (2): bulk enable/disable JWT (websocket bug, `test.fixme`)
- [ ] `agent-configuration-rke2.spec.ts` (1): placeholder, Vue3 skip upstream
- [ ] `node-drivers.spec.ts` (1): placeholder (upstream rancher/dashboard#10275)

### Form blocked by upstream bug

- [ ] `project-secrets.spec.ts`: `creates a project-scoped secret` is `test.fixme`. Save stays disabled because v2.15-head projects no longer expose `status.backingNamespace` (read by `shell/edit/secret/index.vue`). Title test passes. See `docs/DEBUGGING-FAILURES.md`.

## CI / Infra

- [ ] Qase IDs: to be mapped manually by QA
- [ ] Jenkins job for Playwright pipeline (Jenkinsfile in qa-infra-automation)

## Cluster cleanup hardening (orphaned mgmt clusters)

> Tracks qa-tasks#2328: a cleanup that deletes only the v1 provisioning cluster
> leaves the linked v3 management cluster reconciling, which stresses the backend
> across a run. `rancherApi.deleteClusterAndWait` (`support/fixtures/rancher-api.ts`)
> deletes the v1 prov cluster, waits for it to 404, then waits for the linked v3
> management cluster (`status.clusterName`) to 404.

Already applied: `cluster-provisioning-azure-rke2.spec.ts`,
`cluster-provisioning-amazon-ec2-rke2.spec.ts`.

- [ ] **`harvester.spec.ts`**: the import flow creates a real v3 management cluster
  (registration stub, no nodes) plus a linked v1 prov cluster (`fleet-default/<id>`).
  Current cleanup deletes only the v1 prov, orphaning the mgmt cluster. Switch the
  delete to `rancherApi.deleteClusterAndWait`. Confirmed while porting to Cypress:
  the v3 mgmt cluster (`c-86qd2`) lingered after the v1 delete and only reached 404
  once the helper polled for it.
- [ ] **`fleet-clusters.spec.ts`**: currently a stub (see "Need provisioning
  infrastructure" above). When implemented it provisions a real Amazon RKE2 cluster
  (same path as the amazon spec), so use `rancherApi.deleteClusterAndWait` for the
  cluster teardown. The Cypress port confirmed the linked v3 mgmt cluster
  (`c-m-kvvcfvm5`) lingered after the v1 delete.

## Upstream advocacy

- [ ] Push upstream rancher/dashboard to migrate
  `shell/components/SortableTable/paging.js` (and its `debug.js` sibling) to
  TypeScript. Last legacy `.js` files in an otherwise mostly-TS component
  tree; surfaced while debugging the CRD pagination test.

## Chart kubeVersion drift watch

- [ ] **OPA Gatekeeper uninstallable on current head**: k3s bumped to 1.36.1 but
  every published `rancher-gatekeeper` version caps `kubeVersion < 1.36.0-0`,
  so helm refuses with exit code 123 (`cluster-tools.spec.ts` lifecycle).
  `chartGuard` now skips on kubeVersion incompatibility; remove this entry when
  rancher-charts publish a compatible gatekeeper and the tests run again.

## Known chronic flakes: needs deeper investigation

- [ ] **`harvester.spec.ts:108 can auto install harvester`**: fails 3/5 even with the
  current install-flow hardening (page reload after API deployed → navigate to
  /uiplugins#installed → click `extension-reload-banner` if shown → 3-reload
  retry loop with LONG waits). The harvester extension's masthead action
  ("Import Existing") is provided by Vue components registered when the
  extension JS bundle loads; on some Rancher instances the SPA never
  re-registers the plugin after install, so the action button never appears
  no matter how many reloads. Likely a Rancher dashboard plugin-loader race
  we cannot fix without changing the SPA. Options:
  - Accept the flake (current state, retries mask it most of the time);
  - Convert to `test.skip(buttonNotVisible, 'env-level plugin loader race')`;
  - Refactor to test only the API path + extension card visibility, drop
    the cluster-import UI portion.

- [ ] **Sharded-run timeout failures**: a stable-subset sharded run (`@adminUser`
  minus `@prime`/`@noVai`/`@needsInfra`/`@provisioning`) surfaced 9 failures
  alongside dashboard-side SPA crashes in the browser console (`TypeError:
  Cannot read properties of undefined (reading 'replace')`, `this.$el.querySelector
  is not a function`, etc.). The suite pulls a fresh `rancher:head` each run so
  the set drifts. Triage: re-check each against a pinned upstream tag to separate
  genuine head regressions from flakes, then harden or quarantine. The two
  `home.spec.ts` cases were fixed in `b026592` (checkbox column-offset on the
  Cluster Management list; mgmt-side route for the description mock).

  2026-06-09 update: 5× sharded runs + DOM/network artifact triage classified the
  consistent failures. Verdicts below; spec fixes land after the hardening
  validation runs complete.
  - [ ] `cluster-manager.spec.ts:302 navigate to Cluster Machines Page`: Vue
    `TypeError ... 'replace'` + `this.$el.querySelector is not a function`,
    machine table empty; likely a `head` Vue component crash to file upstream.
  - [ ] `cluster-list.spec.ts:9 can group clusters by namespace`: head renamed the
    group-row label `Namespace:` → `Workspace:` (matches upstream Cypress test
    "group by workspace"). Spec fix: update the text filter and test name.
  - [ ] `edit-fake-cluster.spec.ts:19 + :37`: head UI crash — console
    `TypeError: Cannot read properties of undefined (reading 'machineProvider')`
    kills the row action menu. Product bug; see "Upstream issues to file".
  - [ ] `v2prov-capi.spec.ts:67 no machine provider for CAPI clusters`: same
    `machineProvider` TypeError root cause; version cell renders `— —`.
  - [x] `preferences.spec.ts:674 login landing page – home page`: fixed 2026-06-09.
    Post-logout SPA redirect aborted the login fixture's `goto('./home')`
    (`net::ERR_ABORTED`); fixture now retries once, PUT predicate filters 200.
  - [ ] `roles.spec.ts:282 delete a role template from the detail page`: head
    reordered the detail-page action menu; index-based `menuItem(5)` misses.
    Spec fix: select by label instead of index.
  - [ ] `settings-p2.spec.ts:154 can update ui-index`: the `ui-index` advanced
    setting no longer exists on head (no upstream test counterpart either).
    Spec fix: remove the test or guard on setting presence.
  - [ ] `cluster-manager.spec.ts:754 Cluster Provisioning Log Page`: `btn-log`
    tab removed on head (tabs now: node-pools/autoscaler/conditions/events/related).
    Confirm where the provisioning log moved, then repoint or retire the test.
  - [ ] `hosted-cluster-details.spec.ts:142/153/164 node pool tabs`: product bug —
    `management.cattle.io.node` watch stuck in `resourceversion too old` re-sync
    BackOff loop, node data never populates. See "Upstream issues to file".

### Upstream issues to file (2026-06-09 artifact triage)

- [ ] **rancher/dashboard: `machineProvider` getter null-deref on head.**
  `TypeError: Cannot read properties of undefined (reading 'machineProvider')`
  (bundle `index.eb2aed77.js`) when the cluster list/detail renders a cluster
  missing `status.info` / machine provider config. Breaks row action menus and
  version cells (`— —`). Repro: load Cluster Management list on `rancher:head`
  with a fake/CAPI cluster present; see console TypeError. Affects
  `edit-fake-cluster`, `v2prov-capi`, cascades into cluster-list rendering.
- [ ] **rancher/rancher (or dashboard store): `management.cattle.io.node` watch
  `resourceversion too old` re-sync BackOff loop.** Hosted cluster (AKS/EKS/GKE)
  detail node-pool tabs never load; console shows repeated
  `TOO_OLD ... Invalid watch revision, re-syncing` with growing delay. Repro:
  open hosted-cluster detail node-pool tab on `rancher:head` min-resource
  install.
- [ ] **rancher/dashboard: landing-page "specific cluster" select renders zero
  cluster options.** Prefs page → landing page radio "cluster:" → the cluster
  select enables but its option list stays empty (DOM shows no
  `vs__dropdown-option` nodes; console: `All of cluster.x-k8s.io.machine is not
  loaded yet`). Likely same cluster-store breakage family as the
  `machineProvider` TypeError. Our `preferences.spec.ts` "specific cluster" test
  skip-guards on the empty list until fixed.

## Gold-standard audit (Phase 4 + long tail)

Phase 1, 2, 3 and the documentation parts of Phase 5 are closed (see
`docs/AUDIT-PLAYWRIGHT-GOLDEN-STANDARD-2026-05-04.md`). Sharded full-suite runs
have now been done; see "Known chronic flakes" above for the timeout findings.
Remaining Phase 4 items below are the follow-up work:

- [ ] **Phase 4: Parallel-safe lane foundation**
  - [ ] Generate `PARALLELISM.md` from a script (gap-map / po-index style); fail CI on unclassified specs (audit finding #6).
  - [ ] Split serial-global vs parallel-safe Playwright projects.
  - [ ] Per-worker users / storage state for `fullyParallel: true` lanes (F7 unblocked the auth-slug side; user creation is still open).
  - [ ] Namescope created resources by worker/test to avoid server-side collisions.
- [ ] **Long tail (touch as helpers are touched)**
  - [ ] 284 raw class/id locators in POs, track selector type in the PO index, push for upstream `data-testid` attributes on high-value sites.
  - [ ] 214 `any` usages across `e2e/` + `support/`, start with `support/fixtures/rancher-api.ts`, narrow types as helpers are touched.
- [ ] **Phase 5: docs as executable policy**
  - [ ] Snippet type-check step for `WRITING-TESTS.md` examples (would need a docs lint that compiles TS snippets against real types).
  - [ ] Diff `AGENTS.md` against `WRITING-TESTS.md` + `CONTRIBUTING.md` + lint rules to confirm they say the same thing.
