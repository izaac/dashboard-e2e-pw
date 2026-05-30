# TODO

> Synced through upstream `6119bf9` (#17795) + `#17228`; reviewed through `upstream/master 8eed0d0b` (2026-05-29).

---

## Conventions (paramount — apply to every spec)

### Navigation: `goTo()` for setup, `navTo` only when nav is under test

Rationale + edge cases in memory `feedback_upstream-nav-parity.md`. Verified idiomatic against official Playwright docs (Context7, 2026-05-29): `page.goto()` is the documented setup-nav path; UI click-through nav is reserved for nav-under-test.

- Setup / precondition navigation → `goTo()` (direct `page.goto`). Faster, less flaky, NOT an anti-pattern.
- Side-menu `navTo` (`BurgerMenuPo`) → only when navigation / the menu is the thing under test.
- When upstream uses `navTo` for what is, for us, only setup: use `goTo()` and leave an inline `// TODO(upstream-parity): upstream uses navTo here` so the divergence stays auditable.
- Keep `e2e/po/side-bars/burger-side-menu.po.ts` (`BurgerMenuPo`) comprehensive — expand it with new nav targets rather than inlining selectors in specs. (Audited 2026-05-29: covers all upstream methods, returns locators per golden rules instead of baked-in `.should()`.)
- Do NOT port Cypress nav anti-patterns: no fixed waits, no `cy.wait('@alias')` request-sync where Playwright auto-waits, no UI nav purely for setup.
- Compensating coverage: `goTo`-for-setup drops Cypress's incidental menu coverage, so the dedicated nav specs in `e2e/tests/navigation/side-nav/` must walk every path. Covered: per-cluster product nav (`product-side-nav.spec.ts`), highlighting (`product-side-nav-highlighting.spec.ts`), burger structure/pin/tooltips + every global-section link (`main-side-menu.spec.ts`).

### Cluster-mock routes must be RegExps, not globs

The dashboard loads clusters by id via server-side-pagination `?filter=id IN (fleet-default/<name>)` queries. A glob `*` cannot cross the `/` in a namespaced id, so `page.route` patterns must be RegExps. (From the #17228 mgmt-to-prov port.)

---

## Open work

### Upstream follow-ups (from 2026-05-29 review)

- [ ] **#16797 — relocate qase-3227.** Move `can navigate to Cluster Provisioning Log Page` out of the `cluster-manager.spec.ts` "Cluster Details Page and Tabs" block into the RKE2-custom detail context (upstream moved it there). Hosted detail-tab coverage (node-pool tabs on AKS/EKS/GKE, autoscaler hidden, log tab absent on imported) is already ported in `hosted-cluster-details.spec.ts`. Still to verify: "Show Configuration" present in mgmt-node allowed actions.
- [ ] *Optional:* adopt upstream action-menu PO robustness from `db1dd2e` (`getMenuItem` → `contains('[dropdown-menu-item]', name)` + `waitForMenuItem`).

### Stub tests — blocked on provisioning infrastructure

- [ ] `cluster-manager.spec.ts` — 9 `test.fixme` bodies awaiting a shared-cluster lifecycle model. `can create new cluster` (RKE2 Custom + Imported Generic) is live and provisions / cleans up per-test; the remaining bodies assume a shared cluster:
  - RKE2 Custom (7): copy config to clipboard, edit cluster, view YAML editor, download KubeConfig, download YAML, preserve addon config after save, delete cluster.
  - Imported Generic (2): edit imported cluster, delete by bulk actions.
  - Blocker — pick a lifecycle model, then replace the `SHARED_*_NAME` constants with the provisioned name and drop `test.fixme` on each body:
    - `beforeAll`/`afterAll` per describe block (tests run `mode: 'serial'`), or
    - worker-scoped fixture (`test.extend`) that provisions once per worker.
- [ ] `fleet-clusters.spec.ts` (10) — list/details, bundle add/remove, pause/unpause, edit, download, workspace assign, delete.
- [ ] `gitrepo.spec.ts` (1) — `Can create a GitRepo` (needs real fleet multi-cluster).

### Stub tests — other blockers

- [ ] `project-namespace.spec.ts` (1) — creator-principal-id annotation when creating a project via third-party auth; needs an auth provider.
- [ ] `pods.spec.ts` (1) — footer controls stick to bottom in YAML editor; viewport measurement unavailable headless.
- [ ] `jwt-authentication.spec.ts` (2) — bulk enable/disable JWT; websocket bug (`test.fixme`).
- [ ] `agent-configuration-rke2.spec.ts` (1) — placeholder; Vue3 skip upstream.
- [ ] `node-drivers.spec.ts` (1) — placeholder; upstream rancher/dashboard#10275.
- [ ] `project-secrets.spec.ts` — `creates a project-scoped secret` is `test.fixme`: Save stays disabled because v2.15-head projects no longer expose `status.backingNamespace` (read by `shell/edit/secret/index.vue`). Title test passes. See `docs/DEBUGGING-FAILURES.md`.

### Chronic flakes — needs triage

(Line numbers omitted — they drift; identify by test name.)

- [ ] **`harvester.spec.ts` "can auto install harvester"** — fails ~3/5 despite install-flow hardening (reload after API deploy → `/uiplugins#installed` → click `extension-reload-banner` → 3-reload retry). The masthead action ("Import Existing") is provided by Vue components registered when the extension bundle loads; on some Rancher instances the SPA never re-registers the plugin after install, so the button never appears regardless of reloads. Likely a dashboard plugin-loader race we cannot fix from tests. Options: accept the flake (current — retries mask it), `test.skip(buttonNotVisible, 'env-level plugin loader race')`, or refactor to test only the API path + extension-card visibility.
- [ ] **Sharded-run timeouts** — a stable-subset sharded run (`@adminUser` minus `@prime`/`@noVai`/`@needsInfra`/`@provisioning`) surfaced failures alongside SPA console crashes (`Cannot read properties of undefined (reading 'replace')`, `this.$el.querySelector is not a function`). The suite pulls fresh `rancher:head` each run, so the set drifts; triage each against a pinned tag to separate genuine head regressions from flakes. `home.spec.ts` cases fixed in `b026592`. Remaining:
  - [ ] `cluster-manager.spec.ts` "can navigate to Cluster Machines Page" — Vue `TypeError ...'replace'` + `$el.querySelector is not a function`, machine table empty; likely a `head` Vue crash to file upstream.
  - [ ] `cluster-list.spec.ts` "can group clusters by namespace" — namespace group-row never renders; VAI/server-side-pagination grouping change.
  - [ ] `edit-fake-cluster.spec.ts` "registry auth retain ID" + "doc link new tab" — action menu lacks `Edit Config` (same pattern as the cloud-credential bug; `fake-cluster.ts` already links prov→mgmt; needs DOM-snapshot triage). Upstream `db1dd2e` root-caused a related load race (fixed Cypress-side via pagesize-split intercepts); our blueprint already mocks all pagesizes (single regex route) and waits on the loading indicator, so treat these as sharded-run drift.
  - [ ] `v2prov-capi.spec.ts` "no machine provider for CAPI clusters" — artifact not yet triaged.
  - [ ] `preferences.spec.ts` "login landing page – home page" — page still loading at landing-page selection; may relate to the `Error parsing server pref theme` console error.
  - [ ] `roles.spec.ts` "delete a role template from the detail page" — empty-state; 401 on `ext.cattle.io.selfuser`.

### Gold-standard audit — Phase 4 + long tail

Phases 1–3 and the Phase 5 documentation are closed (`docs/AUDIT-PLAYWRIGHT-GOLDEN-STANDARD-2026-05-04.md`).

- [ ] **Phase 4 — parallel-safe lanes**
  - [ ] Generate `PARALLELISM.md` from a script (gap-map / po-index style); fail CI on unclassified specs.
  - [ ] Split serial-global vs parallel-safe Playwright projects.
  - [ ] Per-worker users / storage state for `fullyParallel` lanes (auth-slug side done; user creation still open).
  - [ ] Namescope created resources by worker/test to avoid server-side collisions.
- [ ] **Long tail (touch as helpers are touched)**
  - [ ] ~284 raw class/id locators in POs — track selector type in the PO index; push upstream for `data-testid` on high-value sites.
  - [ ] ~214 `any` usages across `e2e/` + `support/` — start with `support/fixtures/rancher-api.ts`.
- [ ] **Phase 5 — docs as executable policy**
  - [ ] Type-check `WRITING-TESTS.md` snippets (a docs lint that compiles TS snippets against real types).
  - [ ] Diff `AGENTS.md` against `WRITING-TESTS.md` + `CONTRIBUTING.md` + lint rules to confirm they agree.

### CI / Infra

- [ ] Qase IDs — mapped manually by QA.
- [ ] Jenkins job for the Playwright pipeline (Jenkinsfile in qa-infra-automation).

### Upstream advocacy

- [ ] Push rancher/dashboard to migrate `shell/components/SortableTable/paging.js` (and its `debug.js` sibling) to TypeScript — the last legacy `.js` files in an otherwise mostly-TS component tree; surfaced while debugging the CRD pagination test.

---

## Reference — do not re-queue

### Upstream commits reviewed, deliberately NOT ported (2026-05-29)

- `79b5f33` get-support — upstream commented out a flaky cross-origin pricing test (#17869); our PW version only asserts the `href`, so it is not subject to that flake.
- `d0b5072` harvester — plain re-enable of auto-install (no new hardening); our `harvester.spec.ts` is already active and more hardened.
- `db1dd2e` edit-fake-cluster flaky fix — its "expand intercepts" is a Cypress pagesize-split so `cy.wait` can target each; our single regex route + `checkLoadingIndicatorNotVisible()` + Playwright auto-wait already cover it.

### Gap-map false positives (covered under different names)

`docs/ASSERTION-GAP-MAP.md` matches by exact upstream test name. These appear under "Missing" but are actually ported under different names — leave them off the work queue:

- `validating repositories page with percy` → `repositories list page matches snapshot` (visual)
- `should display cluster manager page` → `cluster manager list page matches snapshot` (visual)
- `validating machine deployments page with percy` → `machine deployments page matches snapshot` (visual)
- `validating empty machine sets page with percy` → `empty machine sets page matches snapshot` (visual)
- `should display machines list page` → `machines list page matches snapshot` (visual)
- `should display kontainer drivers list page` → `kontainer drivers list page matches snapshot` (visual)
- `should display continuous delivery page git repo` → `git repo list page matches snapshot` (visual)
- `Validate home page with percy` → `home page matches snapshot` (visual)
- `should create a new pod` / `…folder` / `…validate folder name` / `…delete folder` → consolidated into `should create a pod and manage folders via WebSocket exec`
