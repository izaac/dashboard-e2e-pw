# TODO

## Testing

- [ ] Run full suite against fresh Rancher 2.15 — fix remaining failures
- [ ] Run AWS provisioning specs via ansible pipeline
- [ ] Test release-2.14 branch against Rancher 2.14.x
- [ ] Test release-2.13 branch against Rancher 2.13.x

## Specs to debug

- [ ] `e2e/tests/pages/virtualization-mgmt/harvester.spec.ts` — extension install/uninstall state
- [ ] `e2e/tests/pages/explorer/more-resources/api/custom-resource-definitions.spec.ts` — sequential run causes API server stress

## Remaining test gaps (~10%)

- [ ] Skipped tests needing `page.waitForEvent('download')` (5+ tests)
- [ ] Skipped pagination tests needing `createManyNamespacedResources` helper
- [ ] Skipped pod shell/exec tests (WebSocket TLS issues)

## CI / Infra

- [ ] Qase IDs — to be mapped manually by QA
- [ ] Jenkins job for Playwright pipeline (Jenkinsfile in qa-infra-automation)
- [ ] GitHub Actions workflow for PR validation (lint + typecheck)
