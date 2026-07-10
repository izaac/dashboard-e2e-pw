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
| M | M - 6 tests + feature | `875d324e2e` #17728 | Convert `explorer2/workloads/workload-dashboard.spec.ts` (6 tests) + new `workload-dashboard.po.ts` PO (78 lines, ~7 methods). New Workload Dashboard landing page. Biggest net-new coverage block |
| M | M - 1 test + new PO | `c0271168b1` #15347 | `gitrepo.spec.ts`: add `Can create a GitRepo with GitHub App git authentication`. Needs `SelectOrCreateAuthPo` (new upstream PO, ~16 methods incl. `setGitHubAppSecret`, `createGitHubAppAuth`). Unblocks fleet git-auth coverage |
| M | S - 1 test + banner PO | `fc8dc705c1` #16383 | `cluster-manager.spec.ts` + `users.spec.ts`: add TOC assertion (`creation page should include a table of contents`). Needs `fixed-banner.po.ts` TOC methods |
| M | M - 2 specs re-sync | `24928447df` #17924, `5e44c1c72` #17150 | Repositories Refresh Interval + Chart Install UI improvements. Touch `chart-repositories.po`, `install-charts.po`, `logging.spec`, `chart-install-wizard.spec`, `repositories.spec` |
| M | M - +/-60 lines | `be3879ed2` #18188 (roles part) | `roles.spec.ts` re-sync: we have 18 vs upstream 13 (+5). Resource-class validator i18n keys changed |
| M | M - +/-69 lines | `93a21f141c` #18099 | `extensions.spec.ts`: authenticated private registries. `SelectOrCreateAuthPo` again; `roles.po`, `extensions.po` edits |
| M | S - 1 test | (fleet display-name) | `fleet-cluster-target-display-name.spec.ts`: display name in cluster target selector when editing a gitrepo |
| M | S - beforeNext hook | `a6a5a55b4` #17997 | `beforeNext` added to `cruResource` steps. Audit our `CreateEditViewPo` for a `beforeNext`/step-hook seam |
| L | L - churn, defer | `aeeb8a97a` #18108 | Table-actions resize. Many small selector/assertion tweaks across list POs. Bundle with whichever spec is touched next; do not sweep |
| - | watch | `f6192e983` #10897 | E2E uses Helm instead of Docker. Infrastructural on the upstream side; no direct port |

> Note for future cluster-mock ports (from the `mgmt-to-prov` #17228 port): the
> dashboard loads clusters by id via server-side-pagination
> `?filter=id IN (fleet-default/<name>)` queries — `page.route` patterns must be
> RegExps, not globs, since a glob `*` cannot cross the `/` in a namespaced id.

### Upstream commits May 20 – Jun 8, reviewed 2026-06-10

Context: upstream CI tests against the same floating `rancher/rancher:head`
image we use (`branches-metadata.json`, master → tag `head`, consumed by
`scripts/e2e-docker-start`). They stay green by adapting specs within days,
not because the product issues are fixed. The dashboard bundle our head
rancher serves comes from CDN `dashboard/latest`, rebuilt per master merge
(hours of lag), so the issues under "Monitor upstream for fix" are live on
near-master code; the commits below are spec adaptations to port, not fixes.

| Date | Commit | Verdict |
|------|--------|---------|
| May 30 | `0d4c73d` | upstream removed the provisioning-log tab test; we skip-guard — replace with removal at next sync |
| May 20 | `db1dd2e` | PORTED 2026-06-10: fake-cluster + capi mock objects re-extracted verbatim into `e2e/blueprints/nav/fake-cluster-objects.ts` (status.info, machine pool, cloud cred, by-by routes, edit-capability intercepts); edit-fake-cluster and v2prov-capi green again |
| May 15 | `da8589f` | roles detail action menu fix; we fixed independently via label-based select — verify parity during port |

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
> in `qa-infra-automation` branch `test/dashboard-e2e-pw` (latest, 2026-05-24,
> supersedes `playwright-e2e-adapter`) under `ansible/testing/dashboard-e2e`.

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
- [x] **External Rancher access for cloud-driver provisioning** (now provided by
  muster's `--external`): `EXTERNAL=true yarn local:test` fronts the k3d Rancher
  with a sha256-pinned cloudflared quick tunnel, pins `server-url` to the public
  host, and sets `agent-tls-mode=system-store` so a downstream cloud node can
  register back through the tunnel. The runner defaults `GREP_TAGS=@provisioning`
  and forwards AWS/Azure/GKE/custom-node creds in that mode. Cold-start flake
  (first provisioning reconcile lags the create spec) is absorbed by a throwaway
  imported-cluster warm-up. Validated end-to-end: Amazon EC2 RKE2 create passes
  cold with `retries=0`, no orphan EC2 (afterAll teardown). Not wired into PR
  checks (needs real cloud creds + spend); run manually. See
  `docs/RUNNING-TESTS.md` external-access section.
- [x] **k3d provider (docker-install deprecation prep)**: superseded by the
  muster migration. Provisioning now runs entirely through muster (`yarn local:*`
  / `scripts/local.sh`); the in-repo `k3d-rancher.sh` and compose overlays were
  retired. Remaining follow-up: restart-cycle specs (`feature-flags`,
  `no-vai-setup`, `oidc-provider-setup`) against k3d, where the k8s kubelet
  restart backoff (10s->20s->40s) may exceed current poll budgets; 3-run k3d vs
  3-run docker aggregate diff. Watch upstream enabling `scripts/e2e-k3s-start` in
  their CI (currently experimental, PR #14854 "add but don't use") and re-sync
  helm values when they do.

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
  the set drifts. The two `home.spec.ts` cases were fixed in `b026592` (checkbox
  column-offset on the Cluster Management list; mgmt-side route for the
  description mock).

  2026-06-09/10 update: 5× baseline + 5× post-hardening sharded runs +
  DOM/network artifact triage classified everything. Current state after the
  hardening and head-alignment commits (`74236b6`..`8537f53`):
  - [ ] `cluster-manager.spec.ts:779 navigate to Cluster Machines Page`: Vue
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

## External Rancher access for provisioning tests (future)

> **Superseded by the muster migration.** External access is now implemented in
> muster's `--external` mode (cloudflared quick tunnel, pinned `server-url`,
> `agent-tls-mode=system-store`), driven by `EXTERNAL=true yarn local:test`. The
> in-repo `k3d-rancher.sh` referenced below was retired. The tiered analysis is
> kept for historical context.

The old k3d wrapper (`scripts/k3d-rancher.sh`) set Rancher's
`server-url`/`hostname` to `<lb_ip>.sslip.io`, where `lb_ip` is the
docker-internal load-balancer IP (`172.18.x.x`, RFC1918). That address only
routes from the host and from inside the k3d docker network, so it is fine for
the UI tests we run today but blocks real provisioning: a downstream
`cattle-cluster-agent` reads `server-url`, then must resolve, route to, and
TLS-validate it to register and turn the cluster Active. A private docker IP is
unreachable from any node that is not on that docker network.

sslip.io already mints a valid hostname for any IP, and the Rancher Helm cert
covers whatever `hostname` we set, so the only real blocker is choosing an IP
the downstream nodes can actually route to. Tiers, cheapest first:

- [ ] **Same docker network** (k3d-in-k3d, vcluster, dockerised nodes): no
  change needed, `172.18.x.x` already routes inside the network. Good enough to
  smoke-test the provisioning UI + agent handshake without external infra.
- [ ] **Same LAN** (other VMs/boxes on the host's network): add a
  `RANCHER_EXTERNAL`/`RANCHER_HOSTNAME` mode that sets `hostname` to
  `<host-LAN-ip>.sslip.io` and maps the LB to host `443:443` (so `server-url`
  needs no `:port`). k3d already binds host ports on `0.0.0.0`; just open the
  host firewall for 443. The script's existing `--add-host`/`RANCHER_HOSTNAME`
  escape hatch (k3d-rancher.sh ~line 129) is the hook to build on.
- [ ] **Internet nodes** (AWS/Azure/GKE real machines): need a routable address.
  Options without standing infra: a reverse tunnel (cloudflared free tier,
  ngrok) or a mesh VPN. Set `hostname` to the tunnel/mesh address and the cert
  follows.

Cost note: prefer a zero-charge path. Tailscale's free/personal plan covers up
to 100 devices / 3 users, so a lab host + a handful of provisioned nodes on a
personal tailnet stays free, no public exposure, and no firewall holes, set
`server-url` to the host's Tailscale IP via sslip. cloudflared's free Quick
Tunnel is the fallback if we want zero account state. Avoid anything that bills
per-tunnel or per-seat.

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
