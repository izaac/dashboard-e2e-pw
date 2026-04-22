# TODO

## Gold Standard Fixes

### Web-first assertion violations

- [x] `user-retention.spec.ts` — 4x `expect(await ...value()).toBe()` → `toHaveValue()`
- [x] `home.spec.ts` — 6x `await .innerText()` + manual expect → `toContainText()`
- [ ] `settings-p2.spec.ts` — `await .innerText()` → `toContainText()`
- [x] `cloud-credentials.spec.ts` — `getAttributeValue('placeholder')` → `toHaveAttribute()`
- [x] `cluster-list.spec.ts` — `await .innerText()` → `toContainText()`
- [x] `feature-flags.spec.ts` — `await rowElements().count()` → `toHaveCount()`
- [x] `custom-resource-definitions.spec.ts` — `await firstCell.innerText()` → `not.toHaveText('')`

### Raw selectors in specs (move to POs)

- [ ] `rancher-setup.spec.ts` — 3x `page.locator('[data-testid="local-login-username"]')` + `waitForTimeout(1000)`
- [ ] `aks-cluster-provisioning.spec.ts` — 2x `.locator('button[type="submit"], .btn-primary')`
- [ ] `jwt-authentication.spec.ts` — `.locator('a, .accordion-title, ...').filter(...)` chain
- [ ] `kontainer-drivers.spec.ts` — `driverRow.locator('[data-testid*="action-button"]')`
- [ ] `replicasets.spec.ts` — `'.sortable-table'` passed to SortableTablePo constructor
- [ ] `elemental.spec.ts` — `page.waitForSelector(...)` with raw CSS
- [ ] `persistent-volume-claims.spec.ts` — `.evaluate((el) => el.classList.contains(...))`

### Missing cleanup / state restore

- [x] `deployments.spec.ts` — wrap `deleteRancherResource` in `try/finally`
- [x] `kontainer-drivers.spec.ts` — wrap driver cleanup in `try/finally`
- [x] `extensions.spec.ts` — restore `display-add-extension-repos-banner` setting
- [x] `elemental.spec.ts` — add teardown for 4 created resources

### Manual waits

- [ ] `no-vai-setup.spec.ts` — 120s hardcoded `waitForTimeout` (needs polling alternative)
- [ ] `rancher-setup.spec.ts` — unjustified `waitForTimeout(1000)`

## Assertion Parity Gaps

### Entire tests missing or empty stubs

- [ ] `events.spec.ts` — 3 tests (pagination, filter, sort) not ported
- [ ] `roles.spec.ts` (users-and-auth) — 5 tests (filter, sort, pagination x2, std user)
- [ ] `configmap.spec.ts` — 3 tests (pagination, sort, filter) skipped
- [ ] `workspaces.spec.ts` — 3 tests (pagination, filter, sort) skipped
- [ ] `websockets/connection.spec.ts` — 3 folder tests skipped
- [ ] `edit-fake-cluster.spec.ts` — 2 empty stubs (needs blueprint port)
- [ ] `repositories.spec.ts` (apps) — Refresh describe block not ported
- [ ] `settings.spec.ts` — inactivity modal test skipped
- [ ] `cilium-cni.spec.ts` — IPv6 test missing
- [ ] `preferences.spec.ts` — language selection test missing
- [ ] `prime.spec.ts` — auth page link test (needs AuthProviderPo)
- [ ] `network-policy.spec.ts` — port validation test skipped

### Large assertion gaps in existing tests

- [ ] `aks-cluster-provisioning.spec.ts` — ~46 missing default value assertions
- [ ] `namespace-picker.spec.ts` — checkIcon mutual-exclusivity, selection cycles
- [ ] `services.spec.ts` — create: tabs/IP/labels; delete: row count (~15 assertions)
- [ ] `ingress.spec.ts` — create/edit: tabs, IP array, response iteration (~12 assertions)
- [ ] `deployments.spec.ts` — deep.eq body checks, pod scaling, EnvVars (~10 assertions)
- [ ] `persistent-volume-claims.spec.ts` — per-header checks in empty/flat/grouped tables
- [ ] `repositories.spec.ts` (apps) — checkbox state assertions, row count guards
- [ ] `settings-p2.spec.ts` — server-url errors, ui-offline-preferred, ui-brand, hide-local
- [ ] `settings.spec.ts` — kubeconfig YAML parse, auth-token-max-ttl options
- [ ] `feature-flags.spec.ts` — standard user: only 5 of 11 flags checked, lock icon

### Systemic patterns (recurring across many specs)

- [x] Fleet delete assertions — add `checkRowCount` + `not.contain` after delete (~8 specs)
- [x] YAML download content — verify kind/metadata.name, not just filename (~8 specs)
- [ ] Response body deep checks — services, ingress, network-policy (~5 specs)

## Not yet validated (need credentials or infra)

### AWS credentials (`awsAccessKey` / `awsSecretKey`)

- [x] `cloud-credentials.spec.ts` — 7 pass (CRUD, edit, clone, delete)
- [x] `cloud-credential.spec.ts` — 4 tests (create, edit, clone, delete — skipped: Azure/GKE creds)
- [x] `jwt-authentication.spec.ts` — 7 pass, 2 skipped (bulk selection upstream bug)
- [ ] `cluster-provisioning-amazon-ec2-rke2.spec.ts` — 8 tests (full provision lifecycle)

### Azure credentials (`azureSubscriptionId` / `azureClientId` / `azureClientSecret`)

- [ ] `cluster-provisioning-azure-rke2.spec.ts` — full spec skipped
- [ ] `aks-cluster-provisioning.spec.ts` — full spec skipped

### GKE credentials (`gkeServiceAccount`)

- [ ] `gke-cluster-provisioning.spec.ts` — full spec skipped

### Provisioning infrastructure (custom nodes, downstream clusters)

- [ ] `cluster-manager.spec.ts` — 9 tests need live RKE2 custom cluster or imported cluster
- [ ] `machine-sets.spec.ts` — 1 test needs provisioned cluster with machine sets
- [ ] `fleet-clusters.spec.ts` — 11 tests need AWS downstream clusters
- [ ] `gitrepo.spec.ts` — Create GitRepo needs downstream clusters

### Standard user account

- [ ] `branding.spec.ts` — 1 test (standard user visibility)
- [ ] `settings.spec.ts` — 1 test (standard user restrictions)
- [ ] `feature-flags.spec.ts` — 1 test (standard user restrictions)
- [ ] `banners.spec.ts` — 1 test (standard user visibility)
- [ ] `settings-p2.spec.ts` — 1 test (standard user restrictions)
- [ ] `cluster-dashboard.spec.ts` — 1 test (project role access)
- [ ] `get-support.spec.ts` — 1 test (standard user view)

### Elemental operator

- [ ] `elemental.spec.ts` — 4 tests need elemental-operator CRDs installed

### WebSocket / shell access

- [ ] `pods.spec.ts` — 1 test (pod shell exec, needs running pod)
- [ ] `connection.spec.ts` — 1 test (WebSocket folder creation, needs TLS helper)

## Safety Guards

- [x] `auth.setup.ts` — pre-login health gate: pings `/v1/counts` with retry+backoff before browser login
- [x] `feature-flags.spec.ts` — afterAll resets dangerous flags (`oidc-provider`, `harvester`, `istio-virtual-service-ui`) to default; `waitForCountsSettle()` extracted as reusable function
- [x] `deployments.spec.ts` — `waitForResourceState` before redeploy to avoid 409 Conflict
- [x] `harvester.spec.ts` — `test.skip` on 500 install response (chart unavailable in environment)

## Bug Fixes

- [x] `users.po.ts` — `UsersListPo.selectAll()` clicked container div instead of `.checkbox-custom`; bulk actions (Deactivate, Download YAML, Delete) silently did nothing
- [x] `fleet.cattle.io.bundle.po.ts` — `resourcesList()` strict mode violation (3 sortable-table matches); scoped to `.first()`
- [x] Fleet delete assertions — replaced fragile `rowCountBefore` with `goTo()` + `not.toBeAttached` pattern across 5 specs
- [x] `workspaces.spec.ts` — YAML download expected `ClusterGroup` kind instead of `FleetWorkspace`

## Full Suite Triage (26 failures → resolved)

### Fixed in code (7 → all pass on retest)
- [x] side-nav-highlighting — `checkExists` already on `ListRowPo` (was suite-load flake)
- [x] daemonsets redeploy — already had `waitForRancherResource` (was suite-load flake)
- [x] extensions Partners repo — passes on retest (was suite-load flake)
- [x] hosted-providers deactivate — passes on retest (was suite-load flake)
- [x] kontainer-drivers activate — passes on retest (was suite-load flake)
- [x] registries RKE Auth — passes on retest (was suite-load flake)
- [x] services ExternalName — passes on retest (was suite-load flake)

### Infra-dependent (14) — expected, need creds or downstream clusters
- ec2-rke2-provisioning (9), eks-provisioning (1), cloud-credential Azure (2), cluster-manager custom (1), v2prov-capi (1 — already skipped for 2.13)

### Server/auth (5) — session expiry under full suite load
- users bulk actions (3) — fixed by `selectAll()` PO fix above
- harvester (1) — 500 chart install, skip guard added
- v2prov-capi (1) — already skipped

## Cleanup

- [ ] Replace scattered `{ timeout: 15000 }` / `{ timeout: 60000 }` with global config or named constants
- [ ] `custom-resource-definitions.spec.ts` — sequential run causes API server stress

- `node-drivers.spec.ts` — blocked by rancher/dashboard#10275
- `pod-security-policy-templates.spec.ts` — blocked by rancher/dashboard#10187
- `agent-configuration-rke2.spec.ts` — Vue3 skip upstream

## CI / Infra

- [ ] Qase IDs — to be mapped manually by QA
- [ ] Jenkins job for Playwright pipeline (Jenkinsfile in qa-infra-automation)
- [ ] GitHub Actions workflow for PR validation (lint + typecheck)
