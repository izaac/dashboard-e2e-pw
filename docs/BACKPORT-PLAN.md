# Release Branch Backport Plan

How to create `release-2.14` and `release-2.13` branches with version-appropriate test coverage.

## Strategy

Branch from main, delete specs for features not in that version, fix selector drift. Same model upstream uses for Cypress branches.

**IMPORTANT: Upstream Cypress is always the source of truth.** Every decision — which specs to keep, which to remove, which to add back — must be verified against the upstream release branch. Never guess what features exist in a version. Check the upstream Cypress spec list for that branch.

## Phases

### Phase 1: Finish master migration
- Complete main branch to ~100% parity
- All specs passing against Rancher 2.15

### Phase 2: release-2.14 (~1-2 days)

| Step | Action | Tool |
|------|--------|------|
| 1 | Create `release-2.14` from main | `git checkout -b release-2.14` |
| 2 | Checkout upstream `release-2.14` | `cd ../dashboard && git checkout release-2.14` |
| 3 | Run gap-map against 2.14 upstream | `yarn gap-map` (point UPSTREAM at release-2.14) |
| 4a | Delete specs not in upstream 2.14 | Remove files from gap-map diff |
| 4b | Convert specs only in upstream 2.14 | Deprecated features removed from master still need coverage on older branches |
| 5 | Run po-diff against 2.14 Cypress POs | `yarn po-diff` (point at release-2.14) |
| 6 | Fix PO selector drift | Edit POs where testids/selectors changed |
| 7 | Provision Rancher 2.14.x | `rancher_image_tag: "v2.14.3"` in vars.yaml |
| 8 | Run all specs, fix failures | `npx playwright test --reporter=line` |
| 9 | Update gap-map | `yarn gap-map` |
| 10 | Push branch | `git push -u origin release-2.14` |

### Phase 3: release-2.13 (~2-3 days)
Same as Phase 2. More selector drift expected — older Rancher had fewer `data-testid` attributes.

### Phase 4: CI integration (~0.5 day)
- Jenkins job per branch (or parameterized)
- Each job sets `rancher_image_tag` to match branch version
- Nightly or per-PR schedule

## What changes between versions

| Area | Impact | Fix |
|------|--------|-----|
| Missing specs (new features) | Features don't exist in older versions | Delete spec |
| Missing specs (deprecated) | Features removed from master still exist on older branch | Convert from upstream Cypress |
| Fewer tests per spec | Test covers a feature added later | Delete individual test |
| More tests per spec | Deprecated test removed from master | Convert from upstream Cypress |
| data-testid changes | UI component renamed/restructured | Fix PO selector |
| API endpoint changes | v1/v3 differences, new fields | Fix rancherApi calls |
| Missing UI components | Tabs, buttons, form fields added later | Delete or skip test |

## PO layer absorbs most drift

One PO fix → all specs using it work. The Page Object pattern pays off here.

## Ongoing maintenance

- Bug fixes to tests on main → cherry-pick to release branches if applicable
- New tests on main → don't backport (new features)
- PO fixes → cherry-pick if PO used on that branch
- Framework/tooling changes → cherry-pick to all branches

## Optional tooling

A `branch-backport` script that takes an upstream branch name and outputs the delete list. Uses gap-map internals. Nice-to-have — can do manually with gap-map output.

## Effort estimate

| Phase | Days | Depends on |
|-------|------|------------|
| Finish main migration | In progress | — |
| release-2.14 | 1-2 | Main complete |
| release-2.13 | 2-3 | Main complete |
| CI integration | 0.5 | Branches pushed |
| **Total** | **4-6** | After main done |
