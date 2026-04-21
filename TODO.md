# TODO

## Not yet validated (need credentials or infra)

### AWS credentials (`awsAccessKey` / `awsSecretKey`)

- [x] `cloud-credentials.spec.ts` — 7 pass (CRUD, edit, clone, delete) ✅
- [x] `cloud-credential.spec.ts` — 4 tests (create, edit, clone, delete — skipped: Azure/GKE creds) ✅
- [x] `jwt-authentication.spec.ts` — 7 pass, 2 skipped (bulk selection upstream bug) ✅
- [ ] `cluster-provisioning-amazon-ec2-rke2.spec.ts` — 8 tests (full provision lifecycle)

### Azure credentials (`azureSubscriptionId` / `azureClientId` / `azureClientSecret`)

- [ ] `cluster-provisioning-azure-rke2.spec.ts` — full spec skipped
- [ ] `aks-cluster-provisioning.spec.ts` — full spec skipped

### GKE credentials (`gkeServiceAccount`)

- [ ] `gke-cluster-provisioning.spec.ts` — full spec skipped

### Provisioning infrastructure (custom nodes, downstream clusters)

- [ ] `cluster-manager.spec.ts` — 9 tests need live RKE2 custom cluster or imported cluster
- [ ] `machine-sets.spec.ts` — 1 test needs provisioned cluster with machine sets

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

## Specs to debug

- [ ] `harvester.spec.ts` — extension install/uninstall state management
- [ ] `custom-resource-definitions.spec.ts` — sequential run causes API server stress

## Disabled upstream (not our problem)

- `node-drivers.spec.ts` — blocked by rancher/dashboard#10275
- `pod-security-policy-templates.spec.ts` — blocked by rancher/dashboard#10187
- `agent-configuration-rke2.spec.ts` — Vue3 skip upstream

## CI / Infra

- [ ] Qase IDs — to be mapped manually by QA
- [ ] Jenkins job for Playwright pipeline (Jenkinsfile in qa-infra-automation)
- [ ] GitHub Actions workflow for PR validation (lint + typecheck)
