import { test, expect } from '@/support/fixtures';
import KontainerDriversPagePo from '@/e2e/po/pages/cluster-manager/kontainer-drivers.po';
import KontainerDriverCreateEditPo from '@/e2e/po/edit/kontainer-driver.po';
import DeactivateDriverDialogPo from '@/e2e/po/prompts/deactivateDriverDialog.po';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import ClusterManagerCreatePagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';

const downloadUrl =
  'https://github.com/rancher-plugins/kontainer-engine-driver-example/releases/download/v0.2.3/kontainer-engine-driver-example-copy1-linux-amd64';
const downloadUrlUpdated =
  'https://github.com/rancher-plugins/kontainer-engine-driver-example/releases/download/v0.2.3/kontainer-engine-driver-example-copy2-linux-amd64';
const oracleDriver = 'Oracle OKE';
const openTelekomDriver = 'Open Telekom Cloud CCE';
const linodeDriver = 'Linode LKE';
const exampleDriver = 'Example';

test.describe('Kontainer Drivers', { tag: ['@manager', '@adminUser'] }, () => {
  test('should show the cluster drivers list page', async ({ page, login }) => {
    await login();
    const driversPage = new KontainerDriversPagePo(page);

    await driversPage.goTo();
    await driversPage.waitForPage();
    await expect(driversPage.title()).toBeVisible();
    await driversPage.list().resourceTable().sortableTable().checkVisible();
    await driversPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();
  });

  test('can attempt to refresh kubernetes metadata', async ({ page, login }) => {
    await login();
    const driversPage = new KontainerDriversPagePo(page);

    await driversPage.goTo();
    await driversPage.waitForPage();

    const refreshResp = page.waitForResponse(
      (r) => r.url().includes('/v3/kontainerdrivers?action=refresh') && r.request().method() === 'POST',
      { timeout: 30000 },
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

    // Wait for driver to become active
    await expect(driversPage.list().details(exampleDriver, 1)).toContainText('Active', { timeout: 120000 });

    // Verify driver appears on cluster create page
    await clusterList.goTo();
    await clusterList.waitForPage();
    await clusterList.createCluster();
    await createCluster.waitForPage();
    await createCluster.gridElementExistanceByName('example', 'toBeVisible');

    // Cleanup
    await rancherApi.deleteRancherResource('v3', 'kontainerDrivers', driverId, false);
  });

  test('will show error if could not deactivate driver', async ({ page, login }) => {
    await login();
    const driversPage = new KontainerDriversPagePo(page);

    await page.route('**/v3/kontainerDrivers/opentelekomcloudcontainerengine?action=deactivate', (route) => {
      route.fulfill({ status: 500, body: JSON.stringify({ message: 'Could not deactivate driver' }) });
    });

    await driversPage.goTo();
    await driversPage.waitForPage();
    await driversPage.list().resourceTable().sortableTable().checkVisible();
    await driversPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

    // Only attempt if driver is active
    const stateText = await driversPage.list().details(openTelekomDriver, 1).innerText();

    if (stateText.includes('Active')) {
      const actionMenu = await driversPage.list().actionMenu(openTelekomDriver);

      await actionMenu.getMenuItem('Deactivate').click();

      const deactivateDialog = new DeactivateDriverDialogPo(page);

      await deactivateDialog.deactivate();
      await expect(deactivateDialog.errorBannerContent('Could not deactivate driver')).toBeVisible();
      await deactivateDialog.cancel();
    }
  });

  test('will show error if could not activate driver', async ({ page, login }) => {
    await login();
    const driversPage = new KontainerDriversPagePo(page);

    await page.route('**/v3/kontainerDrivers/linodekubernetesengine?action=activate', (route) => {
      route.fulfill({ status: 500, body: JSON.stringify({ message: 'Could not activate driver' }) });
    });

    await driversPage.goTo();
    await driversPage.waitForPage();
    await driversPage.list().resourceTable().sortableTable().checkVisible();
    await driversPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

    const stateText = await driversPage.list().details(linodeDriver, 1).innerText();

    if (stateText.includes('Inactive')) {
      const actionMenu = await driversPage.list().actionMenu(linodeDriver);

      await actionMenu.getMenuItem('Activate').click();
      await expect(driversPage.growlText()).toContainText('Could not activate driver');
    }
  });

  test('can activate drivers in bulk', async ({ page, login, rancherApi }) => {
    await login();
    const driversPage = new KontainerDriversPagePo(page);
    const clusterList = new ClusterManagerListPagePo(page);
    const createCluster = new ClusterManagerCreatePagePo(page);

    // Ensure both drivers are inactive via API
    const drivers = await rancherApi.getRancherResource('v3', 'kontainerdrivers', undefined, 0);
    const otcDriver = drivers.body?.data?.find(
      (d: any) => d.name === 'opentelekomcloudcontainerengine' || d.uiUrl?.includes('otccce'),
    );
    const okeDriver = drivers.body?.data?.find(
      (d: any) => d.name === 'oraclecontainerengine' || d.uiUrl?.includes('oke'),
    );

    for (const driver of [otcDriver, okeDriver]) {
      if (driver) {
        await rancherApi.createRancherResource('v3', `kontainerDrivers/${driver.id}?action=deactivate`, {}, false);
        await rancherApi.waitForRancherResource(
          'v3',
          'kontainerDrivers',
          driver.id,
          (resp) => resp.body?.active === false,
          30,
          2000,
        );
      }
    }

    await driversPage.goTo();
    await driversPage.waitForPage();
    await driversPage.list().resourceTable().sortableTable().checkVisible();
    await driversPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

    await expect(driversPage.list().details(openTelekomDriver, 1)).toContainText('Inactive', { timeout: 30000 });
    await expect(driversPage.list().details(oracleDriver, 1)).toContainText('Inactive', { timeout: 30000 });

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

    await expect(driversPage.list().details(openTelekomDriver, 1)).toContainText('Active', { timeout: 60000 });
    await expect(driversPage.list().details(oracleDriver, 1)).toContainText('Active', { timeout: 60000 });

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
    const otcDriver = drivers.body?.data?.find(
      (d: any) => d.name === 'opentelekomcloudcontainerengine' || d.uiUrl?.includes('otccce'),
    );
    const okeDriver = drivers.body?.data?.find(
      (d: any) => d.name === 'oraclecontainerengine' || d.uiUrl?.includes('oke'),
    );

    for (const driver of [otcDriver, okeDriver]) {
      if (driver && !driver.active) {
        await rancherApi.createRancherResource('v3', `kontainerDrivers/${driver.id}?action=activate`, {}, false);
      }
    }

    await driversPage.goTo();
    await driversPage.waitForPage();
    await driversPage.list().resourceTable().sortableTable().checkVisible();
    await driversPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

    await expect(driversPage.list().details(openTelekomDriver, 1)).toContainText('Active', { timeout: 60000 });
    await expect(driversPage.list().details(oracleDriver, 1)).toContainText('Active', { timeout: 60000 });

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

    await clusterList.goTo();
    await clusterList.waitForPage();
    await clusterList.createCluster();
    await createCluster.waitForPage();
    await createCluster.gridElementExistanceByName(openTelekomDriver, 'not.toBeVisible');
    await createCluster.gridElementExistanceByName(oracleDriver, 'not.toBeVisible');
  });

  test('can deactivate and activate a single driver', async ({ page, login, rancherApi }) => {
    await login();
    const driversPage = new KontainerDriversPagePo(page);
    const clusterList = new ClusterManagerListPagePo(page);
    const createCluster = new ClusterManagerCreatePagePo(page);

    // Create a fresh example driver
    const existing = await rancherApi.getRancherResource('v3', 'kontainerdrivers', undefined, 0);
    const found = existing.body?.data?.find((d: any) => d.url === downloadUrl);

    if (found) {
      await rancherApi.deleteRancherResource('v3', 'kontainerDrivers', found.id, false);
    }

    const created = await rancherApi.createRancherResource('v3', 'kontainerdrivers', {
      type: 'kontainerDriver',
      active: true,
      url: downloadUrl,
    });
    const driverId = created.body.id;

    // Wait for driver to be active
    await rancherApi.waitForRancherResource(
      'v3',
      'kontainerdrivers',
      driverId,
      (resp) => resp.body?.state === 'active',
      40,
      3000,
    );

    // Deactivate
    await driversPage.goTo();
    await driversPage.waitForPage();
    await driversPage.list().resourceTable().sortableTable().checkVisible();
    await driversPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

    const deactivateResp = page.waitForResponse(
      (r) => r.url().includes('action=deactivate') && r.request().method() === 'POST',
    );

    const actionMenu = await driversPage.list().actionMenu(exampleDriver);

    await actionMenu.getMenuItem('Deactivate').click();
    const deactivateDialog = new DeactivateDriverDialogPo(page);

    await deactivateDialog.deactivate();
    const resp1 = await deactivateResp;

    expect(resp1.status()).toBe(200);

    await clusterList.goTo();
    await clusterList.waitForPage();
    await clusterList.createCluster();
    await createCluster.waitForPage();
    await createCluster.gridElementExistanceByName('example', 'not.toBeVisible');

    // Activate
    await driversPage.goTo();
    await driversPage.waitForPage();
    await driversPage.list().resourceTable().sortableTable().checkVisible();
    await driversPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

    const activateResp = page.waitForResponse(
      (r) => r.url().includes('action=activate') && r.request().method() === 'POST',
    );

    const actionMenu2 = await driversPage.list().actionMenu(exampleDriver);

    await actionMenu2.getMenuItem('Activate').click();
    const resp2 = await activateResp;

    expect(resp2.status()).toBe(200);

    await clusterList.goTo();
    await clusterList.waitForPage();
    await clusterList.createCluster();
    await createCluster.waitForPage();
    await createCluster.gridElementExistanceByName('example', 'toBeVisible');

    // Cleanup
    await rancherApi.deleteRancherResource('v3', 'kontainerDrivers', driverId, false);
  });

  test('can edit a cluster driver', async ({ page, login, rancherApi }) => {
    await login();
    const driversPage = new KontainerDriversPagePo(page);
    const createDriverPage = new KontainerDriverCreateEditPo(page);

    // Create driver via API
    const existing = await rancherApi.getRancherResource('v3', 'kontainerdrivers', undefined, 0);
    const found = existing.body?.data?.find((d: any) => d.url === downloadUrl || d.url === downloadUrlUpdated);

    if (found) {
      await rancherApi.deleteRancherResource('v3', 'kontainerDrivers', found.id, false);
    }

    const created = await rancherApi.createRancherResource('v3', 'kontainerdrivers', {
      type: 'kontainerDriver',
      active: true,
      url: downloadUrl,
    });
    const driverId = created.body.id;

    await rancherApi.waitForRancherResource(
      'v3',
      'kontainerdrivers',
      driverId,
      (resp) => resp.body?.state === 'active',
      40,
      3000,
    );

    await driversPage.goTo();
    await driversPage.waitForPage();
    await driversPage.list().resourceTable().sortableTable().checkVisible();
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

    // Cleanup
    await rancherApi.deleteRancherResource('v3', 'kontainerDrivers', driverId, false);
  });

  test('can delete a driver', async ({ page, login, rancherApi }) => {
    await login();
    const driversPage = new KontainerDriversPagePo(page);

    // Create driver via API
    const existing = await rancherApi.getRancherResource('v3', 'kontainerdrivers', undefined, 0);
    const found = existing.body?.data?.find((d: any) => d.url === downloadUrl || d.url === downloadUrlUpdated);

    if (found) {
      await rancherApi.deleteRancherResource('v3', 'kontainerDrivers', found.id, false);
    }

    const created = await rancherApi.createRancherResource('v3', 'kontainerdrivers', {
      type: 'kontainerDriver',
      active: true,
      url: downloadUrl,
    });
    const driverId = created.body.id;

    await rancherApi.waitForRancherResource(
      'v3',
      'kontainerdrivers',
      driverId,
      (resp) => resp.body?.state === 'active',
      40,
      3000,
    );

    await driversPage.goTo();
    await driversPage.waitForPage();
    await driversPage.list().resourceTable().sortableTable().checkVisible();
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
      { timeout: 15000 },
    );
  });
});
