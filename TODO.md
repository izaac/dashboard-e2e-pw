# TODO

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

## Empty stub tests (24 total)

Tests with empty bodies, marked `// eslint-disable-next-line playwright/expect-expect -- stub body never runs`. Implementation needed once blockers below are resolved.

### Need provisioning infrastructure (downstream / RKE2 / imported clusters)

- [ ] `cluster-manager.spec.ts` (11) — create/edit/copy/yaml/kubeconfig/download/delete on RKE2 custom + imported clusters; one display test
- [ ] `fleet-clusters.spec.ts` (10) — list/details, bundle add/remove, pause/unpause, edit, download, workspace assign, delete
- [ ] `machine-deployments.spec.ts` (1) — download YAML
- [ ] `machine-sets.spec.ts` (1) — download YAML
- [ ] `machines.spec.ts` (1) — download YAML
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

### Plain placeholders (no blocker, just unimplemented)

- [ ] `v2-monitoring.spec.ts` (1) — file-must-have-a-test placeholder
- [x] `cluster-dashboard.spec.ts` — fleet controller hidden for standard user
- [ ] `project-namespace.spec.ts` (1) — most-recent error in multi-error form
- [x] `prime.spec.ts` — both tests live; doc link from i18n via AuthProviderPo + AzureadPo, mock helper at `blueprints/global/prime-version-mock.ts`
- [x] `cloud-credential.spec.ts` — empty cloud credential creation page

### Visual snapshots (Percy → Playwright `toHaveScreenshot`, ported and live)

- [x] `repositories.spec.ts` — repositories list page
- [x] `cluster-manager.spec.ts` — cluster manager list page
- [x] `machine-deployments.spec.ts` — machine deployments list page
- [x] `machine-sets.spec.ts` — empty machine sets list page
- [x] `machines.spec.ts` — machines list page
- [x] `pod-security-admissions.spec.ts` — Pod Security Admissions list page
- [x] `kontainer-drivers.spec.ts` — kontainer drivers list page
- [x] `gitrepo.spec.ts` — git repo / continuous delivery list page
- [x] `home.spec.ts` — home page

### Form blocked by upstream bug

- [ ] `project-secrets.spec.ts` — `creates a project-scoped secret` is `test.fixme`. Save stays disabled because v2.15-head projects no longer expose `status.backingNamespace` (read by `shell/edit/secret/index.vue`). Title test passes. See `DEBUGGING-FAILURES.md`.

## Assertion Parity Gaps

### Other parity gaps

- [ ] `aks-cluster-provisioning.spec.ts` — ~46 missing default value assertions (AKS creds needed for live validation)

### Systemic patterns

- [ ] `custom-resource-definitions.spec.ts` — sequential run causes API server stress

## Not yet validated (need credentials or infra)

### AWS credentials (`awsAccessKey` / `awsSecretKey`)

- [x] `cluster-provisioning-amazon-ec2-rke2.spec.ts` — 8 tests (full provision lifecycle) — create passes, full chain needs live re-run

### Azure credentials (`azureSubscriptionId` / `azureClientId` / `azureClientSecret`)

- [x] `cluster-provisioning-azure-rke2.spec.ts` — PO testids fixed, invalid creds + create + list details + details page pass; snapshot/delete need live re-run

### Elemental operator

- [x] `elemental.spec.ts` — 8/8 atomic with API-seeded operator install + provisioning cluster mock for upgrade-group test

(Provisioning-infra and upstream-blocked stubs are listed in the "Empty stub tests" section above.)

## CI / Infra

- [ ] Qase IDs — to be mapped manually by QA
- [ ] Jenkins job for Playwright pipeline (Jenkinsfile in qa-infra-automation)
