<!-- AUTO-GENERATED reference — update manually as specs are converted -->
# Conversion Roadmap

Generated: 2026-04-17

Use `yarn gap-map` for automated test count comparison. This document classifies specs by infrastructure requirements.

## Can Run Locally (no cloud creds, no downstream clusters)

### Explorer (20 specs, ~72 tests)

| Spec | Tests | Area |
|------|-------|------|
| api/api-services.spec.ts | 1 | API services browsing |
| apps/charts.spec.ts | 9 | Helm charts CRUD |
| apps/index.spec.ts | 1 | App list navigation |
| apps/repositories.spec.ts | 3 | Helm repositories |
| dashboard/certificates.spec.ts | 3 | Certificate viewing |
| dashboard/events.spec.ts | 4 | Event list |
| dashboard/websockets/connection.spec.ts | 4 | WebSocket connections |
| manager/index.spec.ts | 1 | Manager index |
| more-resources/api/custom-resource-definitions.spec.ts | 5 | CRD management |
| more-resources/core/service-accounts.spec.ts | 3 | Service account CRUD |
| more-resources/fleet/contents.spec.ts | 2 | Fleet content browsing |
| more-resources/rbac/cluster-role-bindings.spec.ts | 2 | RBAC binding |
| more-resources/rbac/cluster-roles.spec.ts | 2 | RBAC role creation |
| more-resources/rbac/role-bindings.spec.ts | 3 | Role binding CRUD |
| more-resources/rbac/roles.spec.ts | 3 | Role CRUD |
| more-resources/yaml/no-form-resource.spec.ts | 1 | YAML form fallback |
| policy/network-policy.spec.ts | 4 | Network policy CRUD |
| service-discovery/horizontal-pod-autoscalers.spec.ts | 3 | HPA management |
| service-discovery/ingress.spec.ts | 8 | Ingress CRUD |
| service-discovery/services.spec.ts | 9 | Service management |

### Explorer2 (23 specs, ~111 tests)

| Spec | Tests | Area |
|------|-------|------|
| cluster-project-members.spec.ts | 4 | Project member CRUD |
| cluster-tools.spec.ts | 4 | Cluster tools |
| describe-resource.spec.ts | 1 | Resource describe |
| index.spec.ts | 1 | Explorer2 nav |
| namespace-picker.spec.ts | 8 | Namespace selection |
| nodes/node-detail.spec.ts | 1 | Node detail view |
| nodes/node-list.spec.ts | 1 | Node list |
| project-namespace.spec.ts | 11 | Namespace/project CRUD |
| resource-search.spec.ts | 3 | Resource search |
| storage/configmap.spec.ts | 6 | ConfigMap CRUD |
| storage/persistent-volume-claims.spec.ts | 3 | PVC listing |
| storage/persistent-volumes.spec.ts | 3 | PV browsing |
| storage/project-secrets.spec.ts | 2 | Project secrets |
| storage/secrets.spec.ts | 2 | Secret CRUD |
| storage/storage-classes.spec.ts | 3 | Storage class listing |
| workloads/cronjobs.spec.ts | 5 | CronJob CRUD |
| workloads/daemonsets.spec.ts | 8 | DaemonSet CRUD |
| workloads/deployments.spec.ts | 15 | Deployment CRUD |
| workloads/jobs.spec.ts | 6 | Job CRUD |
| workloads/pods.spec.ts | 10 | Pod CRUD |
| workloads/replicasets.spec.ts | 1 | ReplicaSet management |
| workloads/statefulsets.spec.ts | 7 | StatefulSet CRUD |
| workloads/workloads.spec.ts | 2 | Workload filtering |

### Manager — Local (14 specs, ~69 tests)

| Spec | Tests | Area |
|------|-------|------|
| agent-configuration-rke2.spec.ts | 1 | Agent config display |
| cilium-cni.spec.ts | 1 | Cilium CNI listing |
| cluster-list.spec.ts | 1 | Cluster list pagination |
| edit-fake-cluster.spec.ts | 2 | Fake cluster editing |
| hosted-providers.spec.ts | 5 | Hosted provider cards |
| kontainer-drivers.spec.ts | 12 | Kontainer driver CRUD |
| machine-deployments.spec.ts | 7 | Machine deployment list |
| machine-sets.spec.ts | 7 | Machine set list |
| machines.spec.ts | 5 | Machine pool list |
| node-drivers.spec.ts | 1 | Node driver listing |
| pod-security-admissions.spec.ts | 8 | Pod security policy |
| pod-security-policy-templates.spec.ts | 1 | PSP template listing |
| registries.spec.ts | 3 | Docker registry config |
| repositories.spec.ts | 14 | Helm repositories CRUD |

### Fleet — Local (8 specs, ~46 tests)

| Spec | Tests | Area |
|------|-------|------|
| cluster-groups.spec.ts | 6 | Fleet cluster group CRUD |
| dashboard.spec.ts | 8 | Fleet dashboard |
| helmop.spec.ts | 2 | Helm operator |
| resources/bundle-namespace-mappings.spec.ts | 4 | Bundle mappings |
| resources/bundles.spec.ts | 6 | Bundle CRUD |
| resources/cluster-registration-tokens.spec.ts | 6 | Registration tokens |
| resources/gitrepo-restrictions.spec.ts | 4 | GitRepo restrictions |
| resources/workspaces.spec.ts | 10 | Fleet workspace CRUD |

## Needs Infrastructure / Credentials

### Manager — Cloud (9 specs, ~74 tests)

| Spec | Tests | Requirement |
|------|-------|-------------|
| aks-cluster-provisioning.spec.ts | 2 | Azure creds |
| gke-cluster-provisioning.spec.ts | 1 | GCP service account |
| eks-cluster-provisioning.spec.ts | 3 | AWS creds |
| cluster-provisioning-amazon-ec2-rke2.spec.ts | 10 | AWS creds |
| cluster-provisioning-azure-rke2.spec.ts | 6 | Azure creds |
| cloud-credential.spec.ts | 5 | AWS creds |
| cloud-credentials.spec.ts | 6 | AWS creds |
| cluster-manager.spec.ts | 33 | Feature flags + provisioning |
| jwt-authentication.spec.ts | 8 | AWS creds (EC2 cluster) |

### Fleet — Multi-cluster (2 specs, ~22 tests)

| Spec | Tests | Requirement |
|------|-------|-------------|
| gitrepo.spec.ts | 8 | Downstream clusters |
| fleet-clusters.spec.ts | 14 | Downstream clusters + AWS |

## Summary

| Category | Specs | Tests |
|----------|-------|-------|
| Local-friendly | 65 | ~298 |
| Needs cloud creds | 9 | ~74 |
| Needs multi-cluster | 2 | ~22 |
| Needs feature flags + provisioning | 1 | ~33 |
| **Total remaining** | **77** | **~427** |
