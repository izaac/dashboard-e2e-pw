import { test, expect } from '@/support/fixtures';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import { mockCapiProvCluster, mockCapiMgmtCluster } from '@/e2e/blueprints/manager/v2prov-capi-cluster-mocks';

const clusterName = 'mocked-capi';

test.describe('Cluster List - v2 Provisioning CAPI Clusters', { tag: ['@manager', '@adminUser'] }, () => {
  // Tests share mocked route state - serial prevents route conflicts
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ login, page }) => {
    await page.route('**/v1/provisioning.cattle.io.clusters?*', async (route) => {
      const response = await route.fetch();
      const body = await response.json();

      body.data.push(mockCapiProvCluster);
      await route.fulfill({ json: body });
    });

    await page.route('**/v1/management.cattle.io.clusters?*', async (route) => {
      const response = await route.fetch();
      const body = await response.json();

      body.data.push(mockCapiMgmtCluster);
      await route.fulfill({ json: body });
    });

    await login();

    const clusterList = new ClusterManagerListPagePo(page);

    await clusterList.goTo();
    await clusterList.waitForPage();
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  test('should not provide a link to capi cluster details', async ({ page }) => {
    const clusterList = new ClusterManagerListPagePo(page);

    await expect(clusterList.clusterLink(clusterName)).not.toBeAttached();
    await expect(clusterList.clusterLink('local')).toBeAttached();
  });

  test('should not allow editing CAPI cluster configs', async ({ page }) => {
    const clusterList = new ClusterManagerListPagePo(page);
    const capiMenu = await clusterList.list().actionMenu(clusterName);

    await expect(capiMenu.getMenuItem('Edit Config')).not.toBeAttached();

    await clusterList.list().actionMenuClose(clusterName);

    const localMenu = await clusterList.list().actionMenu('local');

    await expect(localMenu.getMenuItem('Edit Config')).toBeAttached();
  });

  // Rancher 2.13 has no capi-unsupported-warning testid — feature not implemented in this version
  test.skip('should show a message indicating that CAPI clusters are not editable', async ({ page }) => {
    const clusterList = new ClusterManagerListPagePo(page);

    await expect(clusterList.capiWarningSubRow(clusterName)).toBeVisible();
    await expect(clusterList.capiWarningSubRow('Local')).not.toBeAttached();
  });

  test('should not report a machine provider for CAPI clusters', async ({ page }) => {
    const clusterList = new ClusterManagerListPagePo(page);

    const capiProvider = clusterList.list().resourceTable().sortableTable().rowWithName(clusterName).column(4);

    await expect(capiProvider).toHaveText(/ RKE2/);

    const localProvider = clusterList.list().resourceTable().sortableTable().rowWithName('local').column(4);

    await expect(localProvider).toHaveText(/Local (K3s|RKE2)/);
  });
});
