import { test, expect } from '@/support/fixtures';
import HostedProvidersPagePo from '@/e2e/po/pages/cluster-manager/hosted-providers.po';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import ClusterManagerCreatePagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create.po';

const AKS = 'Azure AKS';
const EKS = 'Amazon EKS';
const GKE = 'Google GKE';

async function ensureProviderState(rancherApi: any, providerName: string, active: boolean) {
  const setting = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'kev2-operators');
  const operators: any[] = JSON.parse(setting.body.value || '[]');
  const op = operators.find((o: any) => o.name === providerName);

  if (op && op.active !== active) {
    op.active = active;
    await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'kev2-operators', {
      ...setting.body,
      value: JSON.stringify(operators),
    });
  }
}

async function ensureProvidersState(rancherApi: any, providers: Record<string, boolean>) {
  const setting = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'kev2-operators');
  const operators: any[] = JSON.parse(setting.body.value || '[]');
  let changed = false;

  for (const [name, active] of Object.entries(providers)) {
    const op = operators.find((o: any) => o.name === name);

    if (op && op.active !== active) {
      op.active = active;
      changed = true;
    }
  }

  if (changed) {
    await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'kev2-operators', {
      ...setting.body,
      value: JSON.stringify(operators),
    });
  }
}

// Re-fetch fresh resourceVersion before restoring the original value
async function restoreOperators(rancherApi: any, originalValue: string) {
  const fresh = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'kev2-operators');

  if (fresh.body.value !== originalValue) {
    await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'kev2-operators', {
      ...fresh.body,
      value: originalValue,
    });
  }
}

test.describe('Hosted Providers', { tag: ['@manager', '@adminUser'] }, () => {
  // Tests mutate same global setting 'kev2-operators' - serial prevents conflicts
  test.describe.configure({ mode: 'serial' });
  test('should show the hosted providers list page', async ({ page, login }) => {
    await login();
    const providersPage = new HostedProvidersPagePo(page);

    await providersPage.goTo();
    await providersPage.waitForPage();
    await expect(providersPage.title()).toBeVisible();
    await providersPage.list().resourceTable().sortableTable().checkVisible();
    await providersPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();
  });

  test('can deactivate provider', async ({ page, login, rancherApi }) => {
    const originalSetting = await rancherApi.getRancherResource(
      'v1',
      'management.cattle.io.settings',
      'kev2-operators',
    );
    const originalValue = originalSetting.body.value;

    try {
      await login();
      const providersPage = new HostedProvidersPagePo(page);
      const clusterList = new ClusterManagerListPagePo(page);
      const createCluster = new ClusterManagerCreatePagePo(page);

      await ensureProviderState(rancherApi, 'aks', true);

      await providersPage.goTo();
      await providersPage.waitForPage();
      await providersPage.list().resourceTable().sortableTable().checkVisible();
      await providersPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();
      await expect(providersPage.list().details(AKS, 1)).toContainText('Active', { timeout: 15000 });

      const deactivateResp = page.waitForResponse(
        (r) => r.url().includes('management.cattle.io.settings/kev2-operators') && r.request().method() === 'PUT',
      );
      const actionMenu = await providersPage.list().actionMenu(AKS);

      await actionMenu.getMenuItem('Deactivate').click();
      const resp = await deactivateResp;

      expect(resp.status()).toBe(200);

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.createCluster();
      await createCluster.waitForPage();
      await createCluster.gridElementExistanceByName(AKS, 'not.toBeVisible');
    } finally {
      await restoreOperators(rancherApi, originalValue);
    }
  });

  test('can activate provider', async ({ page, login, rancherApi }) => {
    const originalSetting = await rancherApi.getRancherResource(
      'v1',
      'management.cattle.io.settings',
      'kev2-operators',
    );
    const originalValue = originalSetting.body.value;

    try {
      await login();
      const providersPage = new HostedProvidersPagePo(page);
      const clusterList = new ClusterManagerListPagePo(page);
      const createCluster = new ClusterManagerCreatePagePo(page);

      await ensureProviderState(rancherApi, 'aks', false);

      await providersPage.goTo();
      await providersPage.waitForPage();
      await providersPage.list().resourceTable().sortableTable().checkVisible();
      await providersPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

      const activateResp = page.waitForResponse(
        (r) => r.url().includes('management.cattle.io.settings/kev2-operators') && r.request().method() === 'PUT',
      );
      const actionMenu = await providersPage.list().actionMenu(AKS);

      await actionMenu.getMenuItem('Activate').click();
      const resp = await activateResp;

      expect(resp.status()).toBe(200);

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.createCluster();
      await createCluster.waitForPage();
      await createCluster.gridElementExistanceByName(AKS, 'toBeVisible');
    } finally {
      await restoreOperators(rancherApi, originalValue);
    }
  });

  test('can deactivate providers in bulk', async ({ page, login, rancherApi }) => {
    const originalSetting = await rancherApi.getRancherResource(
      'v1',
      'management.cattle.io.settings',
      'kev2-operators',
    );
    const originalValue = originalSetting.body.value;

    try {
      await login();
      const providersPage = new HostedProvidersPagePo(page);
      const clusterList = new ClusterManagerListPagePo(page);
      const createCluster = new ClusterManagerCreatePagePo(page);

      await ensureProvidersState(rancherApi, { eks: true, gke: true });

      await providersPage.goTo();
      await providersPage.waitForPage();
      await providersPage.list().resourceTable().sortableTable().checkVisible();
      await providersPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();
      await expect(providersPage.list().details(EKS, 1)).toContainText('Active', { timeout: 15000 });
      await expect(providersPage.list().details(GKE, 1)).toContainText('Active', { timeout: 15000 });

      await providersPage.list().resourceTable().sortableTable().rowSelectCtlWithName(EKS).set();
      await providersPage.list().resourceTable().sortableTable().rowSelectCtlWithName(GKE).set();

      const deactivateResp = page.waitForResponse(
        (r) => r.url().includes('management.cattle.io.settings/kev2-operators') && r.request().method() === 'PUT',
      );

      await providersPage.list().deactivate().click();
      const resp = await deactivateResp;

      expect(resp.status()).toBe(200);

      await expect(providersPage.list().details(EKS, 1)).toContainText('Inactive');
      await expect(providersPage.list().details(GKE, 1)).toContainText('Inactive');

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.createCluster();
      await createCluster.waitForPage();
      await createCluster.gridElementExistanceByName(EKS, 'not.toBeVisible');
      await createCluster.gridElementExistanceByName(GKE, 'not.toBeVisible');

      // Restore
      await ensureProvidersState(rancherApi, { eks: true, gke: true });
    } finally {
      await restoreOperators(rancherApi, originalValue);
    }
  });

  test('can activate providers in bulk', async ({ page, login, rancherApi }) => {
    const originalSetting = await rancherApi.getRancherResource(
      'v1',
      'management.cattle.io.settings',
      'kev2-operators',
    );
    const originalValue = originalSetting.body.value;

    try {
      await login();
      const providersPage = new HostedProvidersPagePo(page);
      const clusterList = new ClusterManagerListPagePo(page);
      const createCluster = new ClusterManagerCreatePagePo(page);

      await ensureProvidersState(rancherApi, { eks: false, gke: false });

      await providersPage.goTo();
      await providersPage.waitForPage();
      await providersPage.list().resourceTable().sortableTable().checkVisible();
      await providersPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();
      await expect(providersPage.list().details(EKS, 1)).toContainText('Inactive', { timeout: 15000 });
      await expect(providersPage.list().details(GKE, 1)).toContainText('Inactive', { timeout: 15000 });

      await providersPage.list().resourceTable().sortableTable().rowSelectCtlWithName(EKS).set();
      await providersPage.list().resourceTable().sortableTable().rowSelectCtlWithName(GKE).set();

      const activateResp = page.waitForResponse(
        (r) => r.url().includes('management.cattle.io.settings/kev2-operators') && r.request().method() === 'PUT',
      );

      await providersPage.list().activate().click();
      const resp = await activateResp;

      expect(resp.status()).toBe(200);

      await expect(providersPage.list().details(EKS, 1)).toContainText('Active');
      await expect(providersPage.list().details(GKE, 1)).toContainText('Active');

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.createCluster();
      await createCluster.waitForPage();
      await createCluster.gridElementExistanceByName(EKS, 'toBeVisible');
      await createCluster.gridElementExistanceByName(GKE, 'toBeVisible');
    } finally {
      await restoreOperators(rancherApi, originalValue);
    }
  });
});
