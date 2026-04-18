## Summary

<!-- Brief description of changes -->

## Test plan

- [ ] Ran affected specs locally: `npx playwright test <spec> --reporter=line`
- [ ] No raw selectors in spec files (selectors belong in POs)
- [ ] Tests are atomic (no order dependencies)
- [ ] Tests are idempotent (unique names, try/finally cleanup)
- [ ] Web-first assertions only (`await expect(loc).toBeVisible()`)
- [ ] Imports from `@/support/fixtures` (not `@playwright/test`)

## Upstream parity

- [ ] Checked upstream Cypress spec for reference
- [ ] Same assertions validated
