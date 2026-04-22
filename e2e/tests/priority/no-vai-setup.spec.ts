import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';
import { FeatureFlagsPagePo } from '@/e2e/po/pages/global-settings/feature-flags.po';

const RESTART_TIMEOUT = 120000;

// Vai ('ui-sql-cache') is now on by default. This sets up the `noVai` test suite by disabling it.

test.describe('Disable Vai', { tag: ['@noVai', '@adminUser'] }, () => {
  test.describe.configure({ mode: 'serial' });
  test('Disable Feature Flag', async ({ page, login, rancherApi }) => {
    const key = 'ui-sql-cache';

    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();

    const featureFlagsPage = new FeatureFlagsPagePo(page, 'local');

    // Navigate to feature flags
    await featureFlagsPage.navTo();
    await featureFlagsPage.waitForPage();

    // Check that the flag is not visible in the page and the ff is enabled
    await expect(featureFlagsPage.self()).not.toContainText(key);

    const isEnabled = await rancherApi.isVaiCacheEnabled();

    expect(isEnabled).toBe(true);

    // Disable the feature flag via API
    const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.features', key);
    const resource = resp.body;

    delete resource.links;
    delete resource.metadata.creationTimestamp;
    delete resource.metadata.generation;
    delete resource.metadata.state;

    resource.spec.value = false;

    // This causes Rancher to restart
    await rancherApi.setRancherResource('v1', 'management.cattle.io.features', key, resource);

    // Wait for Rancher to restart
    // This is HORRIBLE, but churned on a better way (see original Cypress test for reasoning)
    await page.waitForTimeout(RESTART_TIMEOUT);

    await featureFlagsPage.goToAndWait();

    // Confirm the feature flag has the correct value
    const confirmed = await rancherApi.waitForRancherResource(
      'v1',
      'management.cattle.io.features',
      key,
      (resp) => resp?.body?.spec?.value === false,
    );

    expect(confirmed).toBe(true);
  });
});
