---
name: Test failure
about: Report a test that fails or is flaky
labels: bug
---

## Spec

<!-- e.g. e2e/tests/pages/manager/repositories.spec.ts -->

## Test name

<!-- e.g. "can create a Helm repository" -->

## Failure type

- [ ] Timeout (element/response never arrived)
- [ ] Selector (element not found)
- [ ] Assertion (wrong value)
- [ ] API error (non-2xx from Rancher)
- [ ] Flaky (passes sometimes)

## Rancher version

<!-- e.g. v2.15.0-head -->

## Error output

```
<!-- Paste from FAILURE-SUMMARY.md or test output -->
```

## Steps to reproduce

```bash
npx playwright test <spec> -g "<test name>" --reporter=line
```
