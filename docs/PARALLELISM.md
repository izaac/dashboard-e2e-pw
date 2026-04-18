# Test Parallelism Classification

Which specs can run in parallel on the same Rancher instance vs which must run serially.

## Summary

| Category | Count | Description |
|----------|-------|-------------|
| SERIAL | 42 | Mutates global state (settings, features, extensions, charts, auth, drivers) |
| PARALLEL | 68 | Namespaced resources only, or read-only |

## Serial Specs (must not overlap)

### Setup / Priority (run first, always)
- `setup/rancher-setup.spec.ts` — bootstraps Rancher
- `priority/no-vai-setup.spec.ts` — toggles ui-sql-cache flag
- `priority/oidc-provider-setup.spec.ts` — toggles oidc-provider flag

### Global Settings
- `global-settings/banners.spec.ts` — writes ui-banners settings
- `global-settings/branding.spec.ts` — writes ui-brand, ui-logo, userpreferences
- `global-settings/feature-flags.spec.ts` — toggles v3/features
- `global-settings/home-links.spec.ts` — writes ui-custom-links
- `global-settings/index.spec.ts` — depends on clean settings state
- `global-settings/performance.spec.ts` — writes ui-performance
- `global-settings/settings.spec.ts` — writes multiple settings
- `global-settings/settings-p2.spec.ts` — writes multiple settings

### User Menu / Generic
- `user-menu/preferences.spec.ts` — writes userpreferences
- `generic/home.spec.ts` — writes userpreferences + ui-custom-links
- `generic/links.spec.ts` — writes ui-custom-links
- `generic/prime.spec.ts` — depends on clean ui-custom-links state

### Extensions / Charts (install/uninstall globally)
- `extensions/extensions.spec.ts`
- `extensions/kubewarden.spec.ts`
- `extensions/elemental/elemental.spec.ts`
- `charts/compliance.spec.ts`
- `charts/logging.spec.ts`
- `charts/monitoring-istio.spec.ts`
- `charts/opa-gatekeeper.spec.ts`
- `charts/rancher-backup.spec.ts`
- `charts/v2-monitoring.spec.ts`
- `charts/chart-install-wizard.spec.ts`

### Manager (global drivers/settings)
- `manager/kontainer-drivers.spec.ts` — activates/deactivates drivers
- `manager/pod-security-admissions.spec.ts`
- `manager/pod-security-policy-templates.spec.ts`
- `manager/cluster-manager.spec.ts` — writes kev2-operators
- `manager/hosted-providers.spec.ts` — writes kev2-operators
- `manager/v2prov-capi.spec.ts` — writes kev2-operators
- `manager/agent-configuration-rke2.spec.ts`
- `manager/jwt-authentication.spec.ts`
- `manager/node-drivers.spec.ts`

### Users & Auth (global RBAC/auth)
- `users-and-auth/roles.spec.ts` — creates global roles
- `users-and-auth/user-retention.spec.ts` — writes retention settings
- `users-and-auth/azuread.spec.ts` — configures auth provider
- `users-and-auth/cognito.spec.ts`
- `users-and-auth/githubapp.spec.ts`
- `users-and-auth/oidcProvider.spec.ts`

### Explorer (global repos)
- `explorer/apps/repositories.spec.ts` — modifies cluster repos

### Virtualization
- `virtualization-mgmt/harvester.spec.ts` — installs extension globally

## Parallel Specs (safe to overlap)

All specs under:
- `explorer2/` (all 23 specs) — namespaced resources
- `explorer/` (all except `apps/repositories.spec.ts`) — namespaced resources, mocks
- `fleet/` (all 10 specs) — scoped fleet resources
- `navigation/` (all 3 specs) — read-only
- `components/` — mock-only
- `accessibility/` — read-only
- `generic/` (about, diagnostic, favicons, get-support, loading, login, not-found-page, version) — read-only
- `manager/` (cloud-credential, cloud-credentials, cluster-list, cilium-cni, edit-fake-cluster, machine-*, registries, provisioning specs) — scoped resources
- `user-menu/` (account-api-keys, logout) — user-scoped
- `users-and-auth/` (users, index) — unique names

## Jenkins Lane Strategy

```
Lane 1 (SERIAL):  setup → priority → global-settings → preferences → extensions → charts
Lane 2 (SERIAL):  manager serial specs → users-and-auth serial specs → harvester
Lane 3 (PARALLEL): explorer + explorer2 (all parallel-safe)
Lane 4 (PARALLEL): fleet + navigation + generic read-only + components
Lane 5 (PARALLEL): manager parallel specs + cloud provisioning
```

Lanes 1-2 need dedicated Rancher instances (or run sequentially on shared).
Lanes 3-5 can share a Rancher instance via Playwright sharding.
