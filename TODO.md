# TODO

## Assertion Parity Gaps

### Tests missing or empty stubs

- [ ] `prime.spec.ts` — auth page link test (needs AuthProviderPo)
- [ ] `aks-cluster-provisioning.spec.ts` — ~46 missing default value assertions

### Systemic patterns

- [ ] `custom-resource-definitions.spec.ts` — sequential run causes API server stress

## Not yet validated (need credentials or infra)

### AWS credentials (`awsAccessKey` / `awsSecretKey`)

- [ ] `cluster-provisioning-amazon-ec2-rke2.spec.ts` — 8 tests (full provision lifecycle)

### Azure credentials (`azureSubscriptionId` / `azureClientId` / `azureClientSecret`)

- [ ] `cluster-provisioning-azure-rke2.spec.ts` — full spec skipped

### Provisioning infrastructure (custom nodes, downstream clusters)

- [ ] `cluster-manager.spec.ts` — 9 tests need live RKE2 custom cluster or imported cluster
- [ ] `machine-sets.spec.ts` — 1 test needs provisioned cluster with machine sets
- [ ] `fleet-clusters.spec.ts` — 11 tests need AWS downstream clusters
- [ ] `gitrepo.spec.ts` — Create GitRepo needs downstream clusters

### Elemental operator

- [ ] `elemental.spec.ts` — 4 tests need elemental-operator CRDs installed

## Blocked Upstream

- `node-drivers.spec.ts` — blocked by rancher/dashboard#10275
- `pod-security-policy-templates.spec.ts` — blocked by rancher/dashboard#10187
- `agent-configuration-rke2.spec.ts` — Vue3 skip upstream

## CI / Infra

- [ ] Qase IDs — to be mapped manually by QA
- [ ] Jenkins job for Playwright pipeline (Jenkinsfile in qa-infra-automation)
