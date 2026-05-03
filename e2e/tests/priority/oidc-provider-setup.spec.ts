import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';
import { FeatureFlagsPagePo } from '@/e2e/po/pages/global-settings/feature-flags.po';
import { LONG, BRIEF } from '@/support/timeouts';

/**
 * OIDC Provider Setup Test
 *
 * Toggling the `oidc-provider` feature flag causes Rancher to self-restart.
 * The test:
 *   1. Click Activate (PUT 200 returns).
 *   2. Wait for Rancher to actually go down (otherwise `waitForHealthy` would
 *      pass against the still-up pre-restart Rancher).
 *   3. Wait for Rancher to come back via `rancherApi.waitForHealthy`.
 *   4. Reload the page, re-login, and verify the flag is now Active.
 *
 * Idempotent: skips if OIDC is already enabled (re-runs against the same
 * Rancher are a no-op).
 */
test.describe('Enable OIDC Provider', { tag: ['@jenkins', '@noPrime', '@adminUser'] }, () => {
  test('Enable Feature Flag', async ({ page, login, rancherApi }) => {
    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();

    const featureFlagsPage = new FeatureFlagsPagePo(page, 'local');

    await featureFlagsPage.navTo();
    await featureFlagsPage.waitForPage();

    // Idempotent: re-runs against an already-OIDC-enabled Rancher are a no-op.
    const oidcState = await featureFlagsPage.list().details('oidc-provider', 0).innerText();

    test.skip(/Active/.test(oidcState), 'OIDC provider feature flag already enabled');

    await expect(featureFlagsPage.list().details('oidc-provider', 0)).toContainText('Disabled');

    await featureFlagsPage.list().clickRowActionMenuItem('oidc-provider', 'Activate');

    // Click Activate inside the prompt-update modal. waitForModal is intentionally false
    // — the modal won't auto-detach because the connection drops as Rancher restarts.
    await featureFlagsPage.clickCardActionButtonAndWait('Activate', 'oidc-provider', false, {
      waitForModal: false,
      waitForRequest: true,
    });

    // Step 1: wait for Rancher to actually go down. Without this, waitForHealthy
    // would pass against the still-up pre-restart Rancher and we'd race the restart.
    await expect
      .poll(
        async () => {
          const resp = await rancherApi.getRancherResource('v1', 'counts', undefined, 0).catch(() => ({ status: 0 }));

          return resp.status;
        },
        { timeout: LONG, intervals: [BRIEF] },
      )
      .not.toBe(200);

    // Step 2: wait for Rancher to come back. Embedded k3s typically restarts in 30–90 s.
    await rancherApi.waitForHealthy(36, 5_000);

    // Step 3: reload the SPA so it reconnects to the restarted Rancher, then verify.
    await page.reload();
    await login();
    await featureFlagsPage.navTo();
    await featureFlagsPage.waitForPage();

    await expect(featureFlagsPage.list().details('oidc-provider', 0)).toContainText('Active');
  });
});
