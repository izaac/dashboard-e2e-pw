import { test, expect } from '@/support/fixtures';
import { FeatureFlagsPagePo } from '@/e2e/po/pages/global-settings/feature-flags.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import HomePagePo from '@/e2e/po/pages/home.po';
import CardPo from '@/e2e/po/components/card.po';

/**
 * Helper: get the current spec.value of a feature flag via API.
 * Returns the boolean value (true = active, false = disabled).
 */
async function getFeatureFlagValue(rancherApi: any, flagName: string): Promise<boolean> {
  const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.features', flagName);
  const spec = resp.body.spec || {};

  // If spec.value is explicitly set, use it; otherwise fall back to status.default
  if (spec.value !== undefined && spec.value !== null) {
    return spec.value;
  }

  return resp.body.status?.default ?? false;
}

/**
 * Helper: set a feature flag to a specific value via API.
 */
async function setFeatureFlagValue(rancherApi: any, flagName: string, value: boolean): Promise<void> {
  const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.features', flagName);
  const body = resp.body;

  body.spec = body.spec || {};
  body.spec.value = value;
  await rancherApi.setRancherResource('v1', 'management.cattle.io.features', flagName, body);
}

test.describe('Feature Flags', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ login, page }) => {
    await login();
    const homePage = new HomePagePo(page);

    await homePage.goTo();
  });

  test(
    'can toggle harvester feature flag',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      const featureFlagsPage = new FeatureFlagsPagePo(page);
      const burgerMenu = new BurgerMenuPo(page);

      // Save original state and ensure flag starts as Active
      const originalValue = await getFeatureFlagValue(rancherApi, 'harvester');

      await setFeatureFlagValue(rancherApi, 'harvester', true);

      await featureFlagsPage.navTo();
      await expect(featureFlagsPage.list().details('harvester', 0)).toContainText('Active');

      // Deactivate
      await featureFlagsPage.list().clickRowActionMenuItem('harvester', 'Deactivate');
      await featureFlagsPage.clickCardActionButtonAndWait('Deactivate', 'harvester', false);

      // Check Updated State: should be disabled
      await expect(featureFlagsPage.list().details('harvester', 0)).toContainText('Disabled');

      // Check side nav
      await burgerMenu.toggle();
      await expect(burgerMenu.links().filter({ hasText: 'Virtualization Management' })).not.toBeAttached();

      // Activate
      await burgerMenu.toggle();
      await featureFlagsPage.list().clickRowActionMenuItem('harvester', 'Activate');
      await featureFlagsPage.clickCardActionButtonAndWait('Activate', 'harvester', true);

      // Check Updated State: should be active
      await expect(featureFlagsPage.list().details('harvester', 0)).toContainText('Active');

      // we now need to reload the page in order to catch the update of the product on the side-nav
      await page.reload();

      // Check side nav
      await burgerMenu.toggle();
      await expect(burgerMenu.links().filter({ hasText: 'Virtualization Management' })).toBeVisible();

      // Restore original state
      await setFeatureFlagValue(rancherApi, 'harvester', originalValue);
    },
  );

  test(
    'can toggle harvester-baremetal-container-workload feature flag',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      const featureFlagsPage = new FeatureFlagsPagePo(page);
      const flagName = 'harvester-baremetal-container-workload';

      // Save original state and ensure flag starts as Disabled
      const originalValue = await getFeatureFlagValue(rancherApi, flagName);

      await setFeatureFlagValue(rancherApi, flagName, false);

      await featureFlagsPage.navTo();
      await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Disabled');

      // Activate
      await featureFlagsPage.list().clickRowActionMenuItem(flagName, 'Activate');
      await featureFlagsPage.clickCardActionButtonAndWait('Activate', flagName, true);

      // Check Updated State: should be active
      await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Active');

      // Deactivate
      await featureFlagsPage.list().clickRowActionMenuItem(flagName, 'Deactivate');
      await featureFlagsPage.clickCardActionButtonAndWait('Deactivate', flagName, false);

      // Check Updated State: should be disabled
      await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Disabled');

      // Restore original state
      await setFeatureFlagValue(rancherApi, flagName, originalValue);
    },
  );

  test(
    'can toggle istio-virtual-service-ui feature flag',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      const featureFlagsPage = new FeatureFlagsPagePo(page);
      const flagName = 'istio-virtual-service-ui';

      // Save original state and ensure flag starts as Active
      const originalValue = await getFeatureFlagValue(rancherApi, flagName);

      await setFeatureFlagValue(rancherApi, flagName, true);

      await featureFlagsPage.navTo();
      await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Active');

      // Deactivate
      await featureFlagsPage.list().clickRowActionMenuItem(flagName, 'Deactivate');
      await featureFlagsPage.clickCardActionButtonAndWait('Deactivate', flagName, false);

      // Check Updated State: should be disabled
      await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Disabled');

      // Activate
      await featureFlagsPage.list().clickRowActionMenuItem(flagName, 'Activate');
      await featureFlagsPage.clickCardActionButtonAndWait('Activate', flagName, true);

      // Check Updated State: should be active
      await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Active');

      // Restore original state
      await setFeatureFlagValue(rancherApi, flagName, originalValue);
    },
  );

  test(
    'can toggle rke1-custom-node-cleanup feature flag',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      const featureFlagsPage = new FeatureFlagsPagePo(page);
      const flagName = 'rke1-custom-node-cleanup';

      // Save original state and ensure flag starts as Active
      const originalValue = await getFeatureFlagValue(rancherApi, flagName);

      await setFeatureFlagValue(rancherApi, flagName, true);

      await featureFlagsPage.navTo();
      await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Active');

      // Deactivate
      await featureFlagsPage.list().clickRowActionMenuItem(flagName, 'Deactivate');
      await featureFlagsPage.clickCardActionButtonAndWait('Deactivate', flagName, false);

      // Check Updated State: should be disabled
      await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Disabled');

      // Activate
      await featureFlagsPage.list().clickRowActionMenuItem(flagName, 'Activate');
      await featureFlagsPage.clickCardActionButtonAndWait('Activate', flagName, true);

      // Check Updated State: should be active
      await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Active');

      // Restore original state
      await setFeatureFlagValue(rancherApi, flagName, originalValue);
    },
  );

  test(
    'can toggle token-hashing feature flag',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      const featureFlagsPage = new FeatureFlagsPagePo(page);
      const flagName = 'token-hashing';

      // token-hashing is a one-way flag: once activated, it cannot be deactivated.
      // Skip this test if it's already been activated (not idempotent safe to re-run).
      const currentValue = await getFeatureFlagValue(rancherApi, flagName);

      test.skip(currentValue === true, 'token-hashing is already activated and cannot be deactivated — one-way flag');

      await featureFlagsPage.navTo();
      await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Disabled');

      // Activate
      await featureFlagsPage.list().clickRowActionMenuItem(flagName, 'Activate');
      await featureFlagsPage.clickCardActionButtonAndWait('Activate', flagName, true);

      // Check Updated State: should be active
      await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Active');

      // Check - No actions available (lock icon visible)
      await page.reload();
      await expect(featureFlagsPage.list().lockIcon(flagName)).toBeVisible();
    },
  );

  test(
    'can toggle unsupported-storage-drivers feature flag',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      const featureFlagsPage = new FeatureFlagsPagePo(page);
      const flagName = 'unsupported-storage-drivers';

      // Save original state and ensure flag starts as Disabled
      const originalValue = await getFeatureFlagValue(rancherApi, flagName);

      await setFeatureFlagValue(rancherApi, flagName, false);

      await featureFlagsPage.navTo();
      await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Disabled');

      // Activate
      await featureFlagsPage
        .list()
        .resourceTable()
        .sortableTable()
        .rowWithName(flagName)
        .self()
        .scrollIntoViewIfNeeded();
      await featureFlagsPage.list().clickRowActionMenuItem(flagName, 'Activate');
      await featureFlagsPage.clickCardActionButtonAndWait('Activate', flagName, true);

      // Check Updated State: should be active
      await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Active');

      // Deactivate
      await featureFlagsPage.navTo();
      await featureFlagsPage
        .list()
        .resourceTable()
        .sortableTable()
        .rowWithName(flagName)
        .self()
        .scrollIntoViewIfNeeded();
      await featureFlagsPage.list().clickRowActionMenuItem(flagName, 'Deactivate');
      await featureFlagsPage.clickCardActionButtonAndWait('Deactivate', flagName, false);

      // Check Updated State: should be disabled
      await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Disabled');

      // Restore original state
      await setFeatureFlagValue(rancherApi, flagName, originalValue);
    },
  );

  test(
    'error when toggling a feature flag is handled correctly',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      const featureFlagsPage = new FeatureFlagsPagePo(page);
      const flagName = 'unsupported-storage-drivers';

      // Ensure flag starts as Disabled so we can try to Activate it
      const originalValue = await getFeatureFlagValue(rancherApi, flagName);

      await setFeatureFlagValue(rancherApi, flagName, false);

      await featureFlagsPage.navTo();
      await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Disabled');

      // Intercept the request to change the feature flag and return an error - 403, permission denied
      let intercepted = false;

      await page.route(`**/v1/management.cattle.io.features/${flagName}`, async (route) => {
        if (route.request().method() === 'PUT' && !intercepted) {
          intercepted = true;
          await route.fulfill({
            status: 403,
            body: JSON.stringify({
              type: 'error',
              links: {},
              code: 'Forbidden',
              message: 'User does not have permission',
            }),
          });
        } else {
          await route.continue();
        }
      });

      // Activate
      await featureFlagsPage
        .list()
        .resourceTable()
        .sortableTable()
        .rowWithName(flagName)
        .self()
        .scrollIntoViewIfNeeded();
      await featureFlagsPage.list().clickRowActionMenuItem(flagName, 'Activate');

      const card = new CardPo(page);

      await card.actionButtonWithText('Activate').click();

      // Check Updated State: should still be disabled
      await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Disabled');

      // Check error message is displayed
      await expect(card.getError()).toContainText('User does not have permission');

      // Press cancel
      await card.actionButtonWithText('Cancel').click();

      // Unroute and restore
      await page.unroute(`**/v1/management.cattle.io.features/${flagName}`);
      await setFeatureFlagValue(rancherApi, flagName, originalValue);
    },
  );

  test(
    'standard user has only read access to Feature Flag page',
    { tag: ['@globalSettings', '@standardUser'] },
    async ({ page, login }) => {
      test.skip(true, 'Requires standard user credentials — no standard user provisioned in test environment');
      await login();
      const homePage = new HomePagePo(page);

      await homePage.goTo();

      const featureFlagsPage = new FeatureFlagsPagePo(page);

      const featureFlags = [
        'continuous-delivery',
        'harvester',
        'harvester-baremetal-container-workload',
        'istio-virtual-service-ui',
        'legacy',
        'multi-cluster-management',
        'rke1-custom-node-cleanup',
        'rke2',
        'token-hashing',
        'unsupported-storage-drivers',
      ];

      await featureFlagsPage.navTo();

      for (const flag of featureFlags) {
        await expect(featureFlagsPage.list().details(flag, 4)).not.toBeAttached();
      }
    },
  );

  test.describe('List', { tag: ['@noVai', '@globalSettings', '@adminUser', '@standardUser'] }, () => {
    test('validate feature flags table header content', async ({ page, rancherApi }) => {
      const featureFlagsPage = new FeatureFlagsPagePo(page);

      await featureFlagsPage.navTo();

      // check table headers are visible
      const expectedHeaders = ['State', 'Name', 'Description', 'Restart Rancher'];
      const headers = featureFlagsPage.list().resourceTable().sortableTable().headerContentCells();

      const count = await headers.count();

      for (let i = 0; i < count; i++) {
        await expect(headers.nth(i)).toHaveText(expectedHeaders[i]);
      }

      await featureFlagsPage.list().resourceTable().sortableTable().checkVisible();
      await featureFlagsPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();
      await expect(featureFlagsPage.list().resourceTable().sortableTable().noRowsText()).not.toBeAttached();

      const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.features');
      // We filter out fleet and ui-sql-cache feature flags
      const featureCount = resp.body.count - 2;
      const rowCount = await featureFlagsPage.list().resourceTable().sortableTable().rowElements().count();

      expect(rowCount).toBe(featureCount);
    });
  });
});
