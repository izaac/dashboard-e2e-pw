import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';
import { FeatureFlagsPagePo } from '@/e2e/po/pages/global-settings/feature-flags.po';

/**
 * OIDC Provider Setup Test
 *
 * This test enables the OIDC Provider feature flag.
 * It's designed to run in Jenkins CI environment as part of the test setup process.
 */
test.describe('Enable OIDC Provider', { tag: ['@jenkins', '@noPrime', '@adminUser'] }, () => {
  test.describe.configure({ mode: 'serial' });
  test('Enable Feature Flag', async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();

    const featureFlagsPage = new FeatureFlagsPagePo(page, 'local');

    await featureFlagsPage.navTo();
    await featureFlagsPage.waitForPage();

    await expect(featureFlagsPage.list().details('oidc-provider', 0)).toContainText('Disabled');

    await featureFlagsPage.list().clickRowActionMenuItem('oidc-provider', 'Activate');

    await featureFlagsPage.clickCardActionButtonAndWait('Activate', 'oidc-provider', true, {
      waitForModal: true,
      waitForRequest: true,
    });

    await expect(featureFlagsPage.list().details('oidc-provider', 0)).toContainText('Active');
  });
});
