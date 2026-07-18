# TODO

> Last upstream sync check: 2026-07-09

## Upstream Sync Status

**Local repo synced up to:** upstream commit `f5e49a55` (Apr 30, 2026) via local
commit `b07a64e` ("Sync upstream: Microsoft Entra ID rebrand + local cluster edit
accordion check").

**Reviewed (not yet ported) up to:** `../dashboard` master at `7570de16f`
(Jul 9, 2026). Re-quantified via `yarn gap-map` (94%, 643/684) and `yarn po-diff`
(287 upstream POs, 98 unported). Validate any port with `yarn local:test`
(muster `--external` for provisioning specs).

### Upstream commits Jun 9 - Jul 9, reviewed 2026-07-09

Ordered by biggest win / lowest effort first.

| Effort | Win | Commit | Verdict / action |
|--------|-----|--------|-------------------|
| M | M - 2 specs re-sync | `24928447df` #17924, `5e44c1c72` #17150 | Repositories Refresh Interval + Chart Install UI improvements. Touch `chart-repositories.po`, `install-charts.po`, `logging.spec`, `chart-install-wizard.spec`, `repositories.spec` |
| M | M - +/-60 lines | `be3879ed2` #18188 (roles part) | `roles.spec.ts` re-sync: we have 18 vs upstream 13 (+5). Resource-class validator i18n keys changed |
| M | M - +/-69 lines | `93a21f141c` #18099 | `extensions.spec.ts`: authenticated private registries. `SelectOrCreateAuthPo` again; `roles.po`, `extensions.po` edits |
| M | S - beforeNext hook | `a6a5a55b4` #17997 | `beforeNext` added to `cruResource` steps. Audit our `CreateEditViewPo` for a `beforeNext`/step-hook seam |
| L | L - churn, defer | `aeeb8a97a` #18108 | Table-actions resize. Many small selector/assertion tweaks across list POs. Bundle with whichever spec is touched next; do not sweep |
| - | watch | `f6192e983` #10897 | E2E uses Helm instead of Docker. Infrastructural on the upstream side; no direct port |

> Note for future cluster-mock ports (from the `mgmt-to-prov` #17228 port): the
> dashboard loads clusters by id via server-side-pagination
> `?filter=id IN (fleet-default/<name>)` queries — `page.route` patterns must be
> RegExps, not globs, since a glob `*` cannot cross the `/` in a namespaced id.

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

> Custom-node and imported-cluster runs are provisioned by the Ansible playbook
> in `qa-infra-automation` branch `test/dashboard-e2e-pw` under
> `ansible/testing/dashboard-e2e-pw` (provisions HA Rancher on a public FQDN +
> import k3s cluster + custom node). Run `./run.sh provision`, then run specs
> locally against the live Rancher (`TEST_BASE_URL`, `TEST_PASSWORD`,
> `CUSTOM_NODE_IP`/`CUSTOM_NODE_KEY`, and `KUBECONFIG` = import cluster).
>
> Verified 2026-07-17 against a live playbook provision: both create tests pass
> end-to-end with `retries:0` (imported registers via kubectl apply, RKE2 custom
> registers over SSH; both reach Active and clean up). Use `GREP_TAGS` to include
> `@needsInfra` locally, since the repo `.env` filters it out by default.

- [ ] `cluster-manager.spec.ts`: create tests pass live; edit/copy/yaml/kubeconfig/download/delete on RKE2 custom + imported clusters stay `test.fixme` pending a shared-cluster lifecycle
  - **Imported Generic**: `can create new cluster` verified live 2026-07-17. Remaining `test.fixme`s reference `SHARED_IMPORT_GENERIC_NAME` static constant rather than the cluster the create test actually provisions:
    - [ ] `can edit imported cluster and see changes afterwards`, needs shared-state refactor (beforeAll fixture creates one cluster, all 3 tests reuse it, afterAll deletes)
    - [ ] `can delete cluster by bulk actions`, same shared-state refactor
  - **RKE2 Custom**: `can create new cluster` verified live 2026-07-17. Remaining `test.fixme`s reference `SHARED_RKE2_CUSTOM_NAME`. Note: the create test leaves RKE2 installed on the custom node, so re-running create needs a fresh (or cleaned) node:
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
- [ ] `fleet-clusters.spec.ts` (10): list/details, bundle add/remove, pause/unpause, edit, download, workspace assign, delete. Pending: hard `test.skip('Requires downstream clusters')` at describe level. Needs a real downstream RKE2 cluster registered to Fleet (the playbook's import k3s cluster is not fleet-registered). Provision path: same Amazon RKE2 create flow, then `rancherApi.deleteClusterAndWait` for teardown (qa-tasks#2328: deleting only the v1 prov cluster leaves the linked v3 mgmt cluster reconciling).
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

- [ ] **Sharded-run timeout failures**: a stable-subset sharded run (`@adminUser`
  minus `@prime`/`@noVai`/`@needsInfra`/`@provisioning`) surfaced 9 failures
  alongside dashboard-side SPA crashes in the browser console (`TypeError:
  Cannot read properties of undefined (reading 'replace')`, `this.$el.querySelector
  is not a function`, etc.). The suite pulls a fresh `rancher:head` each run so
  the set drifts. The two `home.spec.ts` cases were fixed in `b026592` (checkbox
  column-offset on the Cluster Management list; mgmt-side route for the
  description mock).

  2026-06-09/10 update: 5× baseline + 5× post-hardening sharded runs +
  DOM/network artifact triage classified everything. Current state after the
  hardening and head-alignment commits (`74236b6`..`8537f53`):
  - [ ] `cluster-manager.spec.ts:814 navigate to Cluster Machines Page`: Vue
    `TypeError ... 'replace'` + `this.$el.querySelector is not a function`,
    machine table empty; head Vue component crash, still failing.
  - [ ] `hosted-cluster-details.spec.ts:142/153/164 node pool tabs`: product bug —
    `management.cattle.io.node` watch stuck in `resourceversion too old` re-sync
    BackOff loop, node data never populates. See "Monitor upstream for fix".

### Monitor upstream for fix (2026-06-09 artifact triage)

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

- [ ] **Serial-mode borderline queue** (2026-06-10 audit): removed unjustified
  serial from branding, home-links, kontainer-drivers, preferences, v2prov-capi,
  user-retention (all had per-test snapshot/restore). Still need a deeper
  cleanup-pattern read before deciding: settings, settings-p2, roles,
  oidcProvider, extensions, logging, compliance, hosted-providers, links,
  chart-install-wizard, pod-security-admissions, the two cloud provisioning
  specs. Vestigial skip-stubs keep serial deliberately (upstream shape).
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
