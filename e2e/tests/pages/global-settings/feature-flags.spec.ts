import { test, expect } from '@/support/fixtures';
import { FeatureFlagsPagePo } from '@/e2e/po/pages/global-settings/feature-flags.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
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
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test(
    'can toggle harvester feature flag',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      const featureFlagsPage = new FeatureFlagsPagePo(page);
      const burgerMenu = new BurgerMenuPo(page);

      const originalValue = await getFeatureFlagValue(rancherApi, 'harvester');

      await setFeatureFlagValue(rancherApi, 'harvester', true);

      try {
        await featureFlagsPage.navTo();
        await expect(featureFlagsPage.list().details('harvester', 0)).toContainText('Active');

        // Deactivate
        await featureFlagsPage.list().clickRowActionMenuItem('harvester', 'Deactivate');
        await featureFlagsPage.clickCardActionButtonAndWait('Deactivate', 'harvester', false);

        await expect(featureFlagsPage.list().details('harvester', 0)).toContainText('Disabled');

        // Check side nav
        await burgerMenu.toggle();
        await expect(burgerMenu.links().filter({ hasText: 'Virtualization Management' })).not.toBeAttached();

        // Activate
        await burgerMenu.toggle();
        await featureFlagsPage.list().clickRowActionMenuItem('harvester', 'Activate');
        await featureFlagsPage.clickCardActionButtonAndWait('Activate', 'harvester', true);

        await expect(featureFlagsPage.list().details('harvester', 0)).toContainText('Active');

        await page.reload();

        await burgerMenu.toggle();
        await expect(burgerMenu.links().filter({ hasText: 'Virtualization Management' })).toBeVisible();
      } finally {
        await setFeatureFlagValue(rancherApi, 'harvester', originalValue);
      }
    },
  );

  test(
    'can toggle harvester-baremetal-container-workload feature flag',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      const featureFlagsPage = new FeatureFlagsPagePo(page);
      const flagName = 'harvester-baremetal-container-workload';

      const originalValue = await getFeatureFlagValue(rancherApi, flagName);

      await setFeatureFlagValue(rancherApi, flagName, false);

      try {
        await featureFlagsPage.navTo();
        await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Disabled');

        // Activate
        await featureFlagsPage.list().clickRowActionMenuItem(flagName, 'Activate');
        await featureFlagsPage.clickCardActionButtonAndWait('Activate', flagName, true);

        await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Active');

        // Reload to stabilize DOM — store update re-renders table and detaches action menus
        await featureFlagsPage.navTo();

        // Deactivate
        await featureFlagsPage.list().clickRowActionMenuItem(flagName, 'Deactivate');
        await featureFlagsPage.clickCardActionButtonAndWait('Deactivate', flagName, false);

        await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Disabled');
      } finally {
        await setFeatureFlagValue(rancherApi, flagName, originalValue);
      }
    },
  );

  test(
    'can toggle istio-virtual-service-ui feature flag',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      const featureFlagsPage = new FeatureFlagsPagePo(page);
      const flagName = 'istio-virtual-service-ui';

      const originalValue = await getFeatureFlagValue(rancherApi, flagName);

      await setFeatureFlagValue(rancherApi, flagName, true);

      try {
        await featureFlagsPage.navTo();
        await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Active');

        // Deactivate
        await featureFlagsPage.list().clickRowActionMenuItem(flagName, 'Deactivate');
        await featureFlagsPage.clickCardActionButtonAndWait('Deactivate', flagName, false);

        await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Disabled');

        // Reload to stabilize DOM — store update re-renders table and detaches action menus
        await featureFlagsPage.navTo();

        // Activate
        await featureFlagsPage.list().clickRowActionMenuItem(flagName, 'Activate');
        await featureFlagsPage.clickCardActionButtonAndWait('Activate', flagName, true);

        await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Active');
      } finally {
        await setFeatureFlagValue(rancherApi, flagName, originalValue);
      }
    },
  );

  test(
    'can toggle rke1-custom-node-cleanup feature flag',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      const featureFlagsPage = new FeatureFlagsPagePo(page);
      const flagName = 'rke1-custom-node-cleanup';

      const originalValue = await getFeatureFlagValue(rancherApi, flagName);

      await setFeatureFlagValue(rancherApi, flagName, true);

      try {
        await featureFlagsPage.navTo();
        await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Active');

        // Deactivate
        await featureFlagsPage.list().clickRowActionMenuItem(flagName, 'Deactivate');
        await featureFlagsPage.clickCardActionButtonAndWait('Deactivate', flagName, false);

        await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Disabled');

        // Reload to stabilize DOM — store update re-renders table and detaches action menus
        await featureFlagsPage.navTo();

        // Activate
        await featureFlagsPage.list().clickRowActionMenuItem(flagName, 'Activate');
        await featureFlagsPage.clickCardActionButtonAndWait('Activate', flagName, true);

        await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Active');
      } finally {
        await setFeatureFlagValue(rancherApi, flagName, originalValue);
      }
    },
  );

  test(
    'can toggle token-hashing feature flag',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      // token-hashing is a one-way flag: once activated, it cannot be deactivated.
      // Running this test permanently mutates the Rancher instance.
      test.skip(true, 'token-hashing is a one-way flag — activating it permanently changes the Rancher instance');

      const featureFlagsPage = new FeatureFlagsPagePo(page);
      const flagName = 'token-hashing';

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

      const originalValue = await getFeatureFlagValue(rancherApi, flagName);

      await setFeatureFlagValue(rancherApi, flagName, false);

      try {
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

        await expect(featureFlagsPage.list().details(flagName, 0)).toContainText('Disabled');
      } finally {
        await setFeatureFlagValue(rancherApi, flagName, originalValue);
      }
    },
  );

  test(
    'error when toggling a feature flag is handled correctly',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      const featureFlagsPage = new FeatureFlagsPagePo(page);
      const flagName = 'unsupported-storage-drivers';

      const originalValue = await getFeatureFlagValue(rancherApi, flagName);

      await setFeatureFlagValue(rancherApi, flagName, false);

      try {
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

        await page.unroute(`**/v1/management.cattle.io.features/${flagName}`);
      } finally {
        await setFeatureFlagValue(rancherApi, flagName, originalValue);
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
      // UI hides certain flags (see shell/list/management.cattle.io.feature.vue)
      const hiddenFlags = ['fleet', 'ui-sql-cache'];
      const hiddenCount = resp.body.data.filter((f: { id: string }) => hiddenFlags.includes(f.id)).length;
      const featureCount = resp.body.count - hiddenCount;
      const rowCount = await featureFlagsPage.list().resourceTable().sortableTable().rowElements().count();

      expect(rowCount).toBe(featureCount);
    });
  });
});

test.describe('Feature Flags - Standard User', { tag: ['@globalSettings', '@standardUser'] }, () => {
  test('standard user has only read access to Feature Flag page', async ({ page, login, envMeta }) => {
    await login({ username: 'standard_user', password: envMeta.password });

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
  });
});
