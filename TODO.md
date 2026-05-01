# TODO

## Empty stub tests (35 total)

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
- [ ] `kontainer-drivers.spec.ts` (1) — kontainer drivers list page (upstream rancher/dashboard#10275)
- [ ] `node-drivers.spec.ts` (1) — placeholder (upstream rancher/dashboard#10275)
- [ ] `pod-security-admissions.spec.ts` (1) — PSA list page display
- [ ] `pod-security-policy-templates.spec.ts` (1) — placeholder (upstream rancher/dashboard#10187)

### Plain placeholders (no blocker, just unimplemented)

- [ ] `v2-monitoring.spec.ts` (1) — file-must-have-a-test placeholder
- [x] `cluster-dashboard.spec.ts` — fleet controller hidden for standard user
- [ ] `project-namespace.spec.ts` (1) — most-recent error in multi-error form
- [ ] `secrets.spec.ts` (1) — project-scoped secret list display
- [ ] `prime.spec.ts` (1) — prime doc link from i18n (needs AuthProviderPo)
- [x] `cloud-credential.spec.ts` — empty cloud credential creation page

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

- [ ] `elemental.spec.ts` — 4 tests need elemental-operator CRDs installed

(Provisioning-infra and upstream-blocked stubs are listed in the "Empty stub tests" section above.)

## CI / Infra

- [ ] Qase IDs — to be mapped manually by QA
- [ ] Jenkins job for Playwright pipeline (Jenkinsfile in qa-infra-automation)
