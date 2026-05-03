import { test, expect } from '@/support/fixtures';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import KontainerDriversPagePo from '@/e2e/po/pages/cluster-manager/kontainer-drivers.po';
import KontainerDriverCreateEditPo from '@/e2e/po/edit/kontainer-driver.po';
import DeactivateDriverDialogPo from '@/e2e/po/prompts/deactivateDriverDialog.po';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import ClusterManagerCreatePagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import { SHORT_TIMEOUT_OPT, LONG_TIMEOUT_OPT } from '@/support/timeouts';
import { EXTRA_LONG, LONG, VERY_LONG } from '@/support/timeouts';
import { ensureLightTheme, mastheadMasks, visualSnapshot } from '@/support/utils/visual-snapshot';

const downloadUrl =
  'https://github.com/rancher-plugins/kontainer-engine-driver-example/releases/download/v0.2.3/kontainer-engine-driver-example-copy1-linux-amd64';
const downloadUrlUpdated =
  'https://github.com/rancher-plugins/kontainer-engine-driver-example/releases/download/v0.2.3/kontainer-engine-driver-example-copy2-linux-amd64';
const oracleDriver = 'Oracle OKE';
const openTelekomDriver = 'Open Telekom Cloud CCE';
const linodeDriver = 'Linode LKE';
const exampleDriver = 'Example';

/**
 * Wait for a driver to reach the expected active state, then confirm Rancher is healthy.
 */
async function waitForDriverAndHealth(
  rancherApi: RancherApi,
  driverId: string,
  expectedActive: boolean,
): Promise<void> {
  await rancherApi.waitForRancherResource(
    'v3',
    'kontainerDrivers',
    driverId,
    (resp) => resp.body?.active === expectedActive,
    30,
    2000,
  );
  await rancherApi.waitForHealthy();
}

test.describe('Kontainer Drivers', { tag: ['@manager', '@adminUser'] }, () => {
  test.describe.configure({ mode: 'serial' });

  // Snapshot original states of built-in drivers we mutate, so we can restore them
  const originalStates: Record<string, boolean> = {};

  test.beforeAll(async ({ rancherApi }) => {
    const drivers = await rancherApi.getRancherResource('v3', 'kontainerdrivers', undefined, 0);

    for (const id of ['opentelekomcloudcontainerengine', 'oraclecontainerengine']) {
      const driver = drivers.body?.data?.find((d: any) => d.id === id);

      if (driver) {
        originalStates[id] = driver.active;
      }
    }
  });

  // Health gate: confirm Rancher is responsive before each test
  test.beforeEach(async ({ rancherApi }) => {
    await rancherApi.waitForHealthy(4, 3_000);
  });

  test.afterAll(async ({ rancherApi }) => {
    // Restore built-in drivers to their original state
    for (const [id, wasActive] of Object.entries(originalStates)) {
      try {
        const resp = await rancherApi.getRancherResource('v3', 'kontainerDrivers', id);
        const isActive = resp.body?.active;

        if (isActive !== wasActive) {
          const action = wasActive ? 'activate' : 'deactivate';

          await rancherApi.createRancherResource('v3', `kontainerDrivers/${id}?action=${action}`, {}, false);
          await waitForDriverAndHealth(rancherApi, id, wasActive);
        }
      } catch (err: unknown) {
        console.warn(`[kontainer-drivers] afterAll: failed to restore ${id}:`, err);
      }
    }

    // Clean up any leftover example drivers
    try {
      const drivers = await rancherApi.getRancherResource('v3', 'kontainerdrivers', undefined, 0);

      for (const d of drivers.body?.data ?? []) {
        if (d.url === downloadUrl || d.url === downloadUrlUpdated) {
          await rancherApi.deleteRancherResource('v3', 'kontainerDrivers', d.id, false);
        }
      }
    } catch (err: unknown) {
      console.warn('[kontainer-drivers] afterAll: failed to clean example drivers:', err);
    }
  });

  test('should show the cluster drivers list page', async ({ page, login }) => {
    await login();
    const driversPage = new KontainerDriversPagePo(page);

    await driversPage.goTo();
    await driversPage.waitForPage();
    await expect(driversPage.title()).toBeVisible();
    await expect(driversPage.list().resourceTable().sortableTable().self()).toBeVisible();
    await driversPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();
  });

  test('can attempt to refresh kubernetes metadata', async ({ page, login }) => {
    await login();
    const driversPage = new KontainerDriversPagePo(page);

    await driversPage.goTo();
    await driversPage.waitForPage();

    const refreshResp = page.waitForResponse(
      (r) => r.url().includes('/v3/kontainerdrivers?action=refresh') && r.request().method() === 'POST',
      { timeout: LONG },
    );

    await driversPage.refreshKubMetadata().click({ force: true });

    const resp = await refreshResp;

    // Upstream bug #52557: refresh may return non-200 on timeout
    expect.soft(resp.status()).toBe(200);
  });

  test('can create new driver', async ({ page, login, rancherApi }) => {
    await login();
    const driversPage = new KontainerDriversPagePo(page);
    const createDriverPage = new KontainerDriverCreateEditPo(page);
    const clusterList = new ClusterManagerListPagePo(page);
    const createCluster = new ClusterManagerCreatePagePo(page);

    // Cleanup any existing driver with same URL
    const existing = await rancherApi.getRancherResource('v3', 'kontainerdrivers', undefined, 0);

    if (existing.body?.data) {
      const found = existing.body.data.find((d: any) => d.url === downloadUrl);

      if (found) {
        await rancherApi.deleteRancherResource('v3', 'kontainerDrivers', found.id, false);
      }
    }

    await driversPage.goTo();
    await driversPage.waitForPage();

    const createResp = page.waitForResponse(
      (r) => r.url().includes('/v3/kontainerdrivers') && r.request().method() === 'POST',
    );

    await driversPage.createDriver();
    await createDriverPage.waitForPage();
    await createDriverPage.downloadUrl().set(downloadUrl);
    await createDriverPage.saveCreateForm().createEditView().create();

    const resp = await createResp;

    expect(resp.status()).toBe(201);
    const body = await resp.json();
    const driverId = body.id;

    try {
      // Wait for driver to become active + Rancher to stabilize after registration
      await expect(driversPage.list().details(exampleDriver, 1)).toContainText('Active', { timeout: EXTRA_LONG });
      await rancherApi.waitForHealthy();

      // Verify driver appears on cluster create page
      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.createCluster();
      await createCluster.waitForPage();
      await createCluster.gridElementExistanceByName('example', 'toBeVisible');
    } finally {
      await rancherApi.deleteRancherResource('v3', 'kontainerDrivers', driverId, false);
    }
  });

  test('will show error if could not deactivate driver', async ({ page, login }) => {
    await login();
    const driversPage = new KontainerDriversPagePo(page);

    await page.route('**/v3/kontainerDrivers/opentelekomcloudcontainerengine?action=deactivate', (route) => {
      route.fulfill({ status: 500, body: JSON.stringify({ message: 'Could not deactivate driver' }) });
    });

    await driversPage.goTo();
    await driversPage.waitForPage();
    await expect(driversPage.list().resourceTable().sortableTable().self()).toBeVisible();
    await driversPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

    const stateText = await driversPage.list().details(openTelekomDriver, 1).innerText();

    test.skip(!stateText.includes('Active'), 'Driver is not Active — cannot test deactivation error');

    const actionMenu = await driversPage.list().actionMenu(openTelekomDriver);

    await actionMenu.getMenuItem('Deactivate').click();

    const deactivateDialog = new DeactivateDriverDialogPo(page);

    await deactivateDialog.deactivate();
    await expect(deactivateDialog.errorBannerContent('Could not deactivate driver')).toBeVisible();
    await deactivateDialog.cancel();
  });

  test('will show error if could not activate driver', async ({ page, login }) => {
    await login();
    const driversPage = new KontainerDriversPagePo(page);

    await page.route('**/v3/kontainerDrivers/linodekubernetesengine?action=activate', (route) => {
      route.fulfill({ status: 500, body: JSON.stringify({ message: 'Could not activate driver' }) });
    });

    await driversPage.goTo();
    await driversPage.waitForPage();
    await expect(driversPage.list().resourceTable().sortableTable().self()).toBeVisible();
    await driversPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

    const stateText = await driversPage.list().details(linodeDriver, 1).innerText();

    test.skip(!stateText.includes('Inactive'), 'Driver is not Inactive — cannot test activation error');

    const actionMenu = await driversPage.list().actionMenu(linodeDriver);

    await actionMenu.getMenuItem('Activate').click();
    await expect(driversPage.growlText()).toContainText('Could not activate driver');
  });

  test('can activate drivers in bulk', async ({ page, login, rancherApi }) => {
    await login();
    const driversPage = new KontainerDriversPagePo(page);
    const clusterList = new ClusterManagerListPagePo(page);
    const createCluster = new ClusterManagerCreatePagePo(page);

    // Ensure both drivers are inactive via API
    // v3 API: `id` is the full name, `name` is the display name (e.g. id=opentelekomcloudcontainerengine, name=otccce)
    const drivers = await rancherApi.getRancherResource('v3', 'kontainerdrivers', undefined, 0);
    const otcDriver = drivers.body?.data?.find((d: any) => d.id === 'opentelekomcloudcontainerengine');
    const okeDriver = drivers.body?.data?.find((d: any) => d.id === 'oraclecontainerengine');

    for (const driver of [otcDriver, okeDriver]) {
      if (driver && driver.active !== false) {
        await rancherApi.createRancherResource('v3', `kontainerDrivers/${driver.id}?action=deactivate`, {}, false);
        await waitForDriverAndHealth(rancherApi, driver.id, false);
      }
    }

    await driversPage.goTo();
    await driversPage.waitForPage();
    await expect(driversPage.list().resourceTable().sortableTable().self()).toBeVisible();
    await driversPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

    await expect(driversPage.list().details(openTelekomDriver, 1)).toContainText('Inactive', { timeout: LONG });
    await expect(driversPage.list().details(oracleDriver, 1)).toContainText('Inactive', { timeout: LONG });

    await driversPage.list().resourceTable().sortableTable().rowSelectCtlWithName(openTelekomDriver).set();
    await driversPage.list().resourceTable().sortableTable().rowSelectCtlWithName(oracleDriver).set();

    const activateOTC = page.waitForResponse(
      (r) => r.url().includes('opentelekomcloudcontainerengine?action=activate') && r.request().method() === 'POST',
    );
    const activateOracle = page.waitForResponse(
      (r) => r.url().includes('oraclecontainerengine?action=activate') && r.request().method() === 'POST',
    );

    await driversPage.list().activate().click();
    const [respOTC, respOracle] = await Promise.all([activateOTC, activateOracle]);

    expect(respOTC.status()).toBe(200);
    expect(respOracle.status()).toBe(200);

    await expect(driversPage.list().details(openTelekomDriver, 1)).toContainText('Active', { timeout: VERY_LONG });
    await expect(driversPage.list().details(oracleDriver, 1)).toContainText('Active', { timeout: VERY_LONG });

    // Confirm Rancher is healthy after bulk-activating real drivers
    await rancherApi.waitForHealthy();

    await clusterList.goTo();
    await clusterList.waitForPage();
    await clusterList.createCluster();
    await createCluster.waitForPage();
    await createCluster.gridElementExistanceByName(openTelekomDriver, 'toBeVisible');
    await createCluster.gridElementExistanceByName(oracleDriver, 'toBeVisible');
  });

  test('can deactivate drivers in bulk', async ({ page, login, rancherApi }) => {
    await login();
    const driversPage = new KontainerDriversPagePo(page);
    const clusterList = new ClusterManagerListPagePo(page);
    const createCluster = new ClusterManagerCreatePagePo(page);

    // Ensure both drivers are active via API
    const drivers = await rancherApi.getRancherResource('v3', 'kontainerdrivers', undefined, 0);
    const otcDriver = drivers.body?.data?.find((d: any) => d.id === 'opentelekomcloudcontainerengine');
    const okeDriver = drivers.body?.data?.find((d: any) => d.id === 'oraclecontainerengine');

    for (const driver of [otcDriver, okeDriver]) {
      if (driver && !driver.active) {
        await rancherApi.createRancherResource('v3', `kontainerDrivers/${driver.id}?action=activate`, {}, false);
        await waitForDriverAndHealth(rancherApi, driver.id, true);
      }
    }

    await driversPage.goTo();
    await driversPage.waitForPage();
    await expect(driversPage.list().resourceTable().sortableTable().self()).toBeVisible();
    await driversPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

    await expect(driversPage.list().details(openTelekomDriver, 1)).toContainText('Active', { timeout: VERY_LONG });
    await expect(driversPage.list().details(oracleDriver, 1)).toContainText('Active', { timeout: VERY_LONG });

    await driversPage.list().resourceTable().sortableTable().rowSelectCtlWithName(openTelekomDriver).set();
    await driversPage.list().resourceTable().sortableTable().rowSelectCtlWithName(oracleDriver).set();
    await driversPage.list().deactivate().click();

    const deactivateDialog = new DeactivateDriverDialogPo(page);

    const deactivateOTC = page.waitForResponse(
      (r) => r.url().includes('opentelekomcloudcontainerengine?action=deactivate') && r.request().method() === 'POST',
    );
    const deactivateOracle = page.waitForResponse(
      (r) => r.url().includes('oraclecontainerengine?action=deactivate') && r.request().method() === 'POST',
    );

    await deactivateDialog.deactivate();
    const [respOTC, respOracle] = await Promise.all([deactivateOTC, deactivateOracle]);

    expect(respOTC.status()).toBe(200);
    expect(respOracle.status()).toBe(200);

    await expect(driversPage.list().details(openTelekomDriver, 1)).toContainText('Inactive');
    await expect(driversPage.list().details(oracleDriver, 1)).toContainText('Inactive');

    // Confirm Rancher is healthy after bulk-deactivating real drivers
    await rancherApi.waitForHealthy();

    await clusterList.goTo();
    await clusterList.waitForPage();
    await clusterList.createCluster();
    await createCluster.waitForPage();
    await createCluster.gridElementExistanceByName(openTelekomDriver, 'not.toBeVisible');
    await createCluster.gridElementExistanceByName(oracleDriver, 'not.toBeVisible');
  });

  test('can deactivate driver', async ({ page, login, rancherApi }) => {
    await login();
    const driversPage = new KontainerDriversPagePo(page);
    const clusterList = new ClusterManagerListPagePo(page);
    const createCluster = new ClusterManagerCreatePagePo(page);

    // Create a fresh example driver — clean up existing first and wait for removal
    const existing = await rancherApi.getRancherResource('v3', 'kontainerdrivers', undefined, 0);
    const found = existing.body?.data?.find((d: any) => d.url === downloadUrl);

    if (found) {
      await rancherApi.deleteRancherResource('v3', 'kontainerDrivers', found.id, false);
      await rancherApi.waitForRancherResource('v3', 'kontainerdrivers', found.id, (r) => r.status === 404, 20, 2000);
    }

    const created = await rancherApi.createRancherResource('v3', 'kontainerdrivers', {
      type: 'kontainerDriver',
      active: true,
      url: downloadUrl,
    });
    const driverId = created.body.id;

    try {
      // Wait for driver to be active + Rancher healthy after registration
      await waitForDriverAndHealth(rancherApi, driverId, true);

      await driversPage.goTo();
      await driversPage.waitForPage();
      await expect(driversPage.list().resourceTable().sortableTable().self()).toBeVisible();
      await driversPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

      const deactivateResp = page.waitForResponse(
        (r) => r.url().includes('action=deactivate') && r.request().method() === 'POST',
      );

      const actionMenu = await driversPage.list().actionMenu(exampleDriver);

      await actionMenu.getMenuItem('Deactivate').click();
      const deactivateDialog = new DeactivateDriverDialogPo(page);

      await deactivateDialog.deactivate();
      const resp = await deactivateResp;

      expect(resp.status()).toBe(200);

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.createCluster();
      await createCluster.waitForPage();
      await createCluster.gridElementExistanceByName('example', 'not.toBeVisible');
    } finally {
      await rancherApi.deleteRancherResource('v3', 'kontainerDrivers', driverId, false);
    }
  });

  test('can activate driver', async ({ page, login, rancherApi }) => {
    await login();
    const driversPage = new KontainerDriversPagePo(page);
    const clusterList = new ClusterManagerListPagePo(page);
    const createCluster = new ClusterManagerCreatePagePo(page);

    // Create a fresh example driver (inactive)
    const existing = await rancherApi.getRancherResource('v3', 'kontainerdrivers', undefined, 0);
    const found = existing.body?.data?.find((d: any) => d.url === downloadUrl);

    if (found) {
      await rancherApi.deleteRancherResource('v3', 'kontainerDrivers', found.id, false);
      await rancherApi.waitForRancherResource(
        'v3',
        'kontainerdrivers',
        found.id,
        (r: any) => r.status === 404,
        20,
        2000,
      );
    }

    const created = await rancherApi.createRancherResource('v3', 'kontainerdrivers', {
      type: 'kontainerDriver',
      active: false,
      url: downloadUrl,
    });
    const driverId = created.body.id;

    try {
      await driversPage.goTo();
      await driversPage.waitForPage();
      await expect(driversPage.list().resourceTable().sortableTable().self()).toBeVisible();
      await driversPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

      const activateResp = page.waitForResponse(
        (r) => r.url().includes('action=activate') && r.request().method() === 'POST',
        LONG_TIMEOUT_OPT,
      );

      // Inactive drivers show API-generated name, not "Example" — find row by URL
      const table = driversPage.list().resourceTable().sortableTable();
      const row = table.rowWithPartialName('kontainer-engine-driver-example');

      await row.actionBtn().click();
      const actionMenu = table.rowActionMenu();

      await actionMenu.getMenuItem('Activate').click();
      const resp = await activateResp;

      expect(resp.status()).toBe(200);

      // Wait for driver registration + Rancher to stabilize after activation
      await waitForDriverAndHealth(rancherApi, driverId, true);

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.createCluster();
      await createCluster.waitForPage();
      await createCluster.gridElementExistanceByName('example', 'toBeVisible');
    } finally {
      await rancherApi.deleteRancherResource('v3', 'kontainerDrivers', driverId, false);
    }
  });

  test('can edit a cluster driver', async ({ page, login, rancherApi }) => {
    await login();
    const driversPage = new KontainerDriversPagePo(page);
    const createDriverPage = new KontainerDriverCreateEditPo(page);

    // Create driver via API — clean up any existing one first and wait for removal
    const existing = await rancherApi.getRancherResource('v3', 'kontainerdrivers', undefined, 0);
    const found = existing.body?.data?.find((d: any) => d.url === downloadUrl || d.url === downloadUrlUpdated);

    if (found) {
      await rancherApi.deleteRancherResource('v3', 'kontainerDrivers', found.id, false);
      await rancherApi.waitForRancherResource('v3', 'kontainerdrivers', found.id, (r) => r.status === 404, 20, 2000);
    }

    const created = await rancherApi.createRancherResource('v3', 'kontainerdrivers', {
      type: 'kontainerDriver',
      active: true,
      url: downloadUrl,
    });
    const driverId = created.body.id;

    try {
      // Wait for driver registration + Rancher health
      await waitForDriverAndHealth(rancherApi, driverId, true);

      await driversPage.goTo();
      await driversPage.waitForPage();
      await expect(driversPage.list().resourceTable().sortableTable().self()).toBeVisible();
      await driversPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

      const actionMenu = await driversPage.list().actionMenu(exampleDriver);

      await actionMenu.getMenuItem('Edit Config').click();
      await createDriverPage.downloadUrl().set(downloadUrlUpdated);

      const updateResp = page.waitForResponse(
        (r) => r.url().includes('/v3/kontainerDrivers/') && r.request().method() === 'PUT',
      );

      await createDriverPage.saveCreateForm().createEditView().save();
      const resp = await updateResp;

      expect(resp.status()).toBe(200);
    } finally {
      await rancherApi.deleteRancherResource('v3', 'kontainerDrivers', driverId, false);
    }
  });

  test('can delete a driver', async ({ page, login, rancherApi }) => {
    await login();
    const driversPage = new KontainerDriversPagePo(page);

    // Create driver via API — clean up any existing one first and wait for removal
    const existing = await rancherApi.getRancherResource('v3', 'kontainerdrivers', undefined, 0);
    const found = existing.body?.data?.find((d: any) => d.url === downloadUrl || d.url === downloadUrlUpdated);

    if (found) {
      await rancherApi.deleteRancherResource('v3', 'kontainerDrivers', found.id, false);
      await rancherApi.waitForRancherResource('v3', 'kontainerdrivers', found.id, (r) => r.status === 404, 20, 2000);
    }

    const created = await rancherApi.createRancherResource('v3', 'kontainerdrivers', {
      type: 'kontainerDriver',
      active: true,
      url: downloadUrl,
    });
    const driverId = created.body.id;

    // Wait for driver registration + Rancher health before UI interaction
    await waitForDriverAndHealth(rancherApi, driverId, true);

    await driversPage.goTo();
    await driversPage.waitForPage();
    await expect(driversPage.list().resourceTable().sortableTable().self()).toBeVisible();
    await driversPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

    await driversPage.list().resourceTable().sortableTable().rowSelectCtlWithName(exampleDriver).set();
    await driversPage.list().resourceTable().sortableTable().bulkActionButton('Delete').click();

    const promptRemove = new PromptRemove(page);
    const deleteResp = page.waitForResponse(
      (r) => r.url().includes('/v3/kontainerDrivers/') && r.request().method() === 'DELETE',
    );

    await promptRemove.remove();
    const resp = await deleteResp;

    expect(resp.status()).toBe(200);
    await driversPage.waitForPage();
    await expect(driversPage.list().resourceTable().sortableTable().rowElementWithName(exampleDriver)).not.toBeAttached(
      SHORT_TIMEOUT_OPT,
    );
  });
});

test.describe('Visual snapshots', { tag: ['@visual', '@manager', '@adminUser'] }, () => {
  test('kontainer drivers list page matches snapshot', async ({ page, login, rancherApi, isPrime }) => {
    await login();
    const restoreTheme = await ensureLightTheme(rancherApi);

    try {
      const driversPage = new KontainerDriversPagePo(page);

      await driversPage.goTo();
      await driversPage.waitForPage();
      await driversPage.list().resourceTable().sortableTable().waitForReady();

      await expect(page).toHaveScreenshot(visualSnapshot(isPrime, 'kontainer-drivers-list.png'), {
        fullPage: true,
        mask: mastheadMasks(page),
      });
    } finally {
      await restoreTheme();
    }
  });
});
