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

## Empty stub tests

Tests with empty bodies, marked `// eslint-disable-next-line playwright/expect-expect -- stub body never runs`. Implementation needed once blockers below are resolved.

### Need provisioning infrastructure (downstream / RKE2 / imported clusters)

- [ ] `cluster-manager.spec.ts` (11) — create/edit/copy/yaml/kubeconfig/download/delete on RKE2 custom + imported clusters; one display test
- [ ] `fleet-clusters.spec.ts` (10) — list/details, bundle add/remove, pause/unpause, edit, download, workspace assign, delete
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

### Form blocked by upstream bug

- [ ] `project-secrets.spec.ts` — `creates a project-scoped secret` is `test.fixme`. Save stays disabled because v2.15-head projects no longer expose `status.backingNamespace` (read by `shell/edit/secret/index.vue`). Title test passes. See `DEBUGGING-FAILURES.md`.

## Assertion Parity Gaps

### Systemic patterns

- [ ] `custom-resource-definitions.spec.ts` — sequential run causes API server stress

## CI / Infra

- [ ] Qase IDs — to be mapped manually by QA
- [ ] Jenkins job for Playwright pipeline (Jenkinsfile in qa-infra-automation)

## Gold-standard audit (Phase 4 + long tail) — revisit after a full sharded suite run

Phase 1, 2, 3 and the documentation parts of Phase 5 are closed (see
`docs/AUDIT-PLAYWRIGHT-GOLDEN-STANDARD-2026-05-04.md`). Remaining items
intentionally deferred until we have results from a fresh sharded full-suite
run — that surfaces which serial groups are actually expensive and which
specs would benefit most from per-worker isolation:

- [ ] **Phase 4 — Parallel-safe lane foundation**
  - [ ] Generate `PARALLELISM.md` from a script (gap-map / po-index style); fail CI on unclassified specs (audit finding #6).
  - [ ] Split serial-global vs parallel-safe Playwright projects.
  - [ ] Per-worker users / storage state for `fullyParallel: true` lanes (F7 unblocked the auth-slug side; user creation is still open).
  - [ ] Namescope created resources by worker/test to avoid server-side collisions.
- [ ] **Long tail (touch as helpers are touched)**
  - [ ] 284 raw class/id locators in POs — track selector type in the PO index, push for upstream `data-testid` attributes on high-value sites.
  - [ ] One remaining raw chained `.bg-success` selector in `cluster-provisioning-amazon-ec2-rke2.spec.ts:280` — move behind a PO method.
  - [ ] 214 `any` usages across `e2e/` + `support/` — start with `support/fixtures/rancher-api.ts`, narrow types as helpers are touched.
- [ ] **Phase 5 — docs as executable policy**
  - [ ] Snippet type-check step for `WRITING-TESTS.md` examples (would need a docs lint that compiles TS snippets against real types).
  - [ ] Diff `AGENTS.md` against `WRITING-TESTS.md` + `CONTRIBUTING.md` + lint rules to confirm they say the same thing.
