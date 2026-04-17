# Assertion Gap Map

> Generated 2026-04-16. Compares upstream Cypress specs in `/home/izaac/repos/dashboard`
> against Playwright specs in `/home/izaac/repos/dashboard-e2e-pw`.
>
> Agents: use this file to know exactly which tests still need writing or strengthening.
> Each checkbox is one unit of work. Checked items are done; unchecked items are gaps.

---

## pages/generic/about.spec.ts

Upstream tests: 13 | Playwright tests: 13 | Gap: 0

All upstream tests are present in Playwright.

### Weakened assertions

- [ ] "can download macOS CLI" / "can download Linux CLI" / "can download Windows CLI" — upstream clicks the download link, intercepts the HTTP response, and asserts `response.statusCode === 200` plus URL contains the correct version string. PW only checks `href` contains `releases.rancher.com/cli2`. **Add:** intercept the download response and assert status 200 + URL contains the CLI version extracted from the href.

---

## pages/generic/home.spec.ts

Upstream tests: 18 | Playwright tests: 18 | Gap: 1 missing + 1 N/A visual

### Missing tests

- [ ] "Can navigate to release notes page for latest Rancher version" — opens notification center, clicks the release notes primary action button, stubs `window.open`, and asserts the opened URL contains `github.com/rancher/rancher/releases` (community) or `documentation.suse.com/cloudnative/rancher-manager` (prime), opened in `_blank`. Requires `rancherApi.getRancherVersion()` to determine prime vs community.

### N/A (visual regression)

- "Validate home page with percy" — Percy snapshot, not applicable to Playwright migration.

### Weakened assertions

- [ ] "Can see that cluster details match those in Cluster Management page" — upstream navigates to Cluster Management page and cross-checks state/name/version/provider columns between home and cluster management. PW only checks `local` row is visible and version is not dash. **Add:** navigate to cluster management page, read the same columns, and assert they match.

---

## pages/generic/login.spec.ts

Upstream tests: 3 | Playwright tests: 3 | Gap: 0

All upstream tests are fully covered with equivalent assertions.

### Weakened assertions

- [ ] "Log in with valid credentials" — upstream takes a Percy snapshot before login (`cy.percySnapshot('Login test')`). PW skips this. N/A (visual regression).
- [ ] "Cannot login with invalid credentials" — upstream asserts `cy.url().should('include', '/auth/login')` after failed login. PW asserts response status 401 but does not assert URL remains on login page. **Add:** `await expect(page).toHaveURL(/\/auth\/login/)`.

---

## pages/generic/loading.spec.ts

Upstream tests: 2 | Playwright tests: 2 | Gap: 0

All upstream tests are fully covered with equivalent assertions.

---

## pages/charts/logging.spec.ts

Upstream tests: 2 | Playwright tests: 2 | Gap: 0

Both "is installed and a rule created" and "can uninstall both chart and crd at once" are present with equivalent assertions. PW version is actually more robust with API-based pre-checks.

---

## pages/charts/monitoring-istio.spec.ts

Upstream tests: 1 (active) | Playwright tests: 1 | Gap: 0

The only active upstream test is "Prometheus and Grafana should have all relevant storage options and Storage Class inputs". The commented-out "Should install monitoring app with comprehensive configuration validation" is disabled upstream due to reliability issues (see dashboard#15253, dashboard#15260).

> Note: The upstream file name is `monitoring-istio.spec.ts` but it only tests Monitoring chart config, not Istio. The Playwright spec matches this.

---

## pages/charts/v2-monitoring.spec.ts

Upstream tests: 1 (active) | Playwright tests: 1 | Gap: 0

Upstream has `it('every file must have a test...')` as a placeholder — all real tests are commented out with `describe.skip` pending Vue3 migration. PW mirrors this placeholder. No action needed until upstream re-enables these tests.

### Skipped upstream tests (for future reference)

- "alertmanagerconfig should have property proxyURL correctly filled out" — mocks V2 monitoring install, creates alertmanager config with PagerDuty receiver, asserts `proxyURL` in request payload
- "multiple Alerting Rules in PrometheusRule should have different values" — creates PrometheusRule with two groups, asserts each group has correct name/interval/rules
- "Alerting Rules Severity select should NOT be translating values to Chinese" — switches language to Chinese, creates alert rule, asserts severity label is still English ("critical")

---

## pages/charts/rancher-backup.spec.ts

Upstream tests: 1 | Playwright tests: 1 | Gap: 0

"Should auto-select default storage class" is fully covered with equivalent assertions.

---

## pages/charts/compliance.spec.ts

Upstream tests: 2 | Playwright tests: 2 | Gap: 0

Both "Footer controls should sticky to bottom" and "Complete install and a Scan is created" are present.

### Weakened assertions

- [ ] "Complete install and a Scan is created" — upstream verifies `checkRowCount(false, 2)` on the compliance list after scan creation. PW does not assert row count after scan. **Add:** after scan creation, navigate back to compliance list and verify the scan row appears in the table.

---

## pages/charts/chart-install-wizard.spec.ts

Upstream tests: 2 | Playwright tests: 2 | Gap: 0

Both "Resource dropdown picker has ConfigMaps listed" and "should persist custom registry when changing chart version" are present with equivalent assertions.

---

## pages/global-settings/branding.spec.ts

Upstream tests: 10 | Playwright tests: 3 | Gap: 7

### Missing tests

- [ ] "Logo" — enables custom logo checkbox, uploads light SVG (`rancher-color.svg`) and dark SVG (`rancher-white.svg`), applies settings, verifies logo preview elements are visible for both dark and light, switches theme to Dark via Preferences page, asserts header brand logo image `src` matches base64 of dark SVG, toggles burger menu and asserts burger menu brand logo matches, switches theme to Light and repeats assertions with light SVG. Then resets custom logo and verifies default rancher logo is restored. Requires: file upload support, Preferences page PO, theme switching, base64 fixture comparison.

- [ ] "Banner" — enables custom banner checkbox, uploads light banner SVG and dark banner SVG, applies settings, verifies banner preview elements visible, switches theme to Dark, navigates to home page and asserts banner image `src` matches base64 of dark banner, switches to Light and repeats with light banner. Resets and verifies default banner. Requires: file upload, theme switching, home page banner image PO method.

- [ ] "Login Background (Dark)" — enables custom login background checkbox, uploads dark background SVG, applies, verifies only dark preview visible (light preview should `not.exist`), switches theme to Dark, navigates to login page and asserts login background image `src` matches base64. Logs back in, resets, restores theme to Light. Requires: file upload, login page PO `loginBackgroundImage()` method.

- [ ] "Login Background (Light)" — same pattern as dark but uploads light background only, verifies only light preview visible, checks login page shows light background. Resets and verifies default login landscape image restored.

- [ ] "Favicon" — enables custom favicon checkbox, uploads custom SVG favicon, applies, asserts API response `value` contains base64 data, verifies favicon preview `src` matches, verifies `head link[rel="shortcut icon"]` href matches. Resets and verifies default `/favicon.png` restored. Requires: branding page PO `customFaviconCheckbox()`, `faviconPreview()` methods, file upload.

- [ ] "Primary Color" — enables primary color checkbox, sets color picker to `#f80dd8`, applies, asserts color picker value and preview color match, asserts Apply button has new background color CSS. Reloads page and re-asserts. Navigates to login page and asserts submit button background color matches. Reloads login page and re-asserts. Logs back in, resets color. Requires: branding page PO `primaryColorCheckbox()`, `primaryColorPicker()` with `value()`, `previewColor()`, `set()` methods.

- [ ] "Link Color" — enables link color checkbox, sets color picker to `#ddd603`, applies, asserts color picker value and preview color match. Reloads and re-asserts. Navigates to login page and asserts password show button has new CSS color. Reloads login and re-asserts. Logs back in, resets. Requires: branding page PO `linkColorCheckbox()`, `linkColorPicker()` methods.

### Weakened assertions

- [ ] "Private Label" — upstream mocks the GET settings response after reload to verify the label persists server-side; PW only checks `toHaveTitle(new RegExp(...))`. **Add:** after reload, assert exact page title `${new} - Homepage` (not just regex containment).
- [ ] "standard user has only read access to Branding page" — upstream checks `privateLabel` is disabled, all checkboxes are disabled (`customLogoCheckbox`, `customFaviconCheckbox`, `primaryColorCheckbox`, `linkColorCheckbox`), and apply button does not exist. PW only checks `privateLabel` disabled and save button not attached. **Add:** assert all branding checkboxes are disabled.

---

## pages/global-settings/settings.spec.ts

Upstream tests: 13 | Playwright tests: 13 | Gap: 1

### Missing tests

- [ ] "Inactivity ::: can update auth-user-session-idle-ttl-minutes and should show the inactivity modal" — updates the `auth-user-session-idle-ttl-minutes` setting, intercepts UserActivity GET/PUT to fake an imminent expiration timestamp, waits for the inactivity modal to appear, asserts modal title contains "Session expiring", body contains expected warning text, clicks "Resume Session", asserts modal closes, navigates away, waits 20s, asserts modal does not reappear, then resets setting. Requires: SettingsPage PO `inactivityModalCard()` method, UserActivity API route interception. **Note:** this test uses `cy.wait(12000)` and `cy.wait(20000)` — consider using Playwright `page.waitForSelector` with timeout instead.

### Notes

PW has "standard user has only read access to Settings page" which upstream places in `settings-p2.spec.ts`. This is fine — the assertions are equivalent, just reorganized.

---

## pages/global-settings/settings-p2.spec.ts

Upstream tests: 11 | Playwright tests: 11 | Gap: 0

All upstream tests are fully covered with equivalent assertions.

---

## pages/global-settings/performance.spec.ts

Upstream tests: 6 | Playwright tests: 6 | Gap: 0

All upstream tests are fully covered with equivalent assertions. PW version validates both request and response bodies for each toggle, matching upstream.

---

## pages/global-settings/feature-flags.spec.ts

Upstream tests: 9 | Playwright tests: 9 | Gap: 0

All upstream tests are fully covered with equivalent assertions.

---

## pages/global-settings/banners.spec.ts

Upstream tests: 16 | Playwright tests: 19 | Gap: 0 (PW exceeds upstream)

PW has expanded the banner settings migration tests to cover additional migration scenarios (header/footer/consent banner migration from `ui-banners` to individual settings). All upstream tests are present.

### Missing from PW (verify)

- [ ] "Show Banner" / "Hide banner" (consent banner toggle pair) — upstream has two small tests inside `Consent Banner` describe block that toggle consent banner visibility. **Verify:** PW may have merged these into the "can show and hide Login Screen Banner" test. Check if consent banner show/hide cycle is fully exercised in PW. If the PW "can show and hide Login Screen Banner" test covers the exact same toggle+assert cycle, this is not a gap.

---

## pages/global-settings/home-links.spec.ts

Upstream tests: 4 | Playwright tests: 4 | Gap: 0

All upstream tests are fully covered.

---

## pages/extensions/extensions.spec.ts

Upstream tests: 17 | Playwright tests: 16 | Gap: 1

### Missing tests

- [ ] "add repository" — navigates to Extensions page, clicks "Add Repositories" button, adds a Helm repository by URL `https://github.com/rancher/ui-plugin-examples`, selects branch `main`, clicks Create, waits for repo creation API response (POST to `catalog.cattle.io.clusterrepos`), asserts response status 201. Then verifies the repository appears in the Extensions repository list. Requires: ExtensionsPage PO `addRepositories()` method, repository creation form PO. **Note:** this test is separate from the "Add Rancher Repositories" test which adds the Partners repo via the banner button.

---

## Summary

| Suite | Upstream | PW | Missing | Weakened |
|---|---|---|---|---|
| generic/about.spec.ts | 13 | 13 | 0 | 3 (CLI downloads) |
| generic/home.spec.ts | 18 | 18 | 1 | 1 |
| generic/login.spec.ts | 3 | 3 | 0 | 1 |
| generic/loading.spec.ts | 2 | 2 | 0 | 0 |
| charts/logging.spec.ts | 2 | 2 | 0 | 0 |
| charts/monitoring-istio.spec.ts | 1 | 1 | 0 | 0 |
| charts/v2-monitoring.spec.ts | 1 | 1 | 0 | 0 |
| charts/rancher-backup.spec.ts | 1 | 1 | 0 | 0 |
| charts/compliance.spec.ts | 2 | 2 | 0 | 1 |
| charts/chart-install-wizard.spec.ts | 2 | 2 | 0 | 0 |
| global-settings/branding.spec.ts | 10 | 3 | 7 | 2 |
| global-settings/settings.spec.ts | 13 | 13 | 1 | 0 |
| global-settings/settings-p2.spec.ts | 11 | 11 | 0 | 0 |
| global-settings/performance.spec.ts | 6 | 6 | 0 | 0 |
| global-settings/feature-flags.spec.ts | 9 | 9 | 0 | 0 |
| global-settings/banners.spec.ts | 16 | 19 | 0 | 0 |
| global-settings/home-links.spec.ts | 4 | 4 | 0 | 0 |
| extensions/extensions.spec.ts | 17 | 16 | 1 | 0 |
| **TOTAL** | **131** | **126** | **10** | **8** |

### Priority order (by impact)

1. **branding.spec.ts** — 7 missing tests (Logo, Banner, Login Background Dark/Light, Favicon, Primary Color, Link Color). All require file upload PO support.
2. **settings.spec.ts** — 1 missing (Inactivity modal). Complex test with time-sensitive intercepts.
3. **extensions.spec.ts** — 1 missing (add repository). Straightforward.
4. **home.spec.ts** — 1 missing (release notes navigation via notification center). Moderate.
5. **Weakened assertions** — 8 items across about, home, login, compliance, branding specs. Each is a small delta.
