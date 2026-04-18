import { test, expect } from '@/support/fixtures';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import { mockCapiProvCluster, mockCapiMgmtCluster } from '@/e2e/blueprints/manager/v2prov-capi-cluster-mocks';

const clusterName = 'mocked-capi';

test.describe('Cluster List - v2 Provisioning CAPI Clusters', { tag: ['@manager', '@adminUser'] }, () => {
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

  test('should not allow editing CAPI cluster configs', async ({ page }) => {
    const clusterList = new ClusterManagerListPagePo(page);
    const capiMenu = await clusterList.list().actionMenu(clusterName);

    await expect(capiMenu.getMenuItem('Edit Config')).not.toBeAttached();

    await clusterList.list().actionMenuClose(clusterName);
    await expect(page.locator('[dropdown-menu-collection]:visible')).toHaveCount(0);

    const localMenu = await clusterList.list().actionMenu('local');

    await expect(localMenu.getMenuItem('Edit Config')).toBeAttached();
  });

  test('should not report a machine provider for CAPI clusters', async ({ page }) => {
    const clusterList = new ClusterManagerListPagePo(page);

    const capiProvider = clusterList.list().resourceTable().sortableTable().rowWithName(clusterName).column(4);

    await expect(capiProvider).toHaveText(/ RKE2/);

    const localProvider = clusterList.list().resourceTable().sortableTable().rowWithName('local').column(4);
    const localText = (await localProvider.innerText()).replace(/\s+/g, ' ').trim();

    expect(localText).toMatch(/^Local (K3s|RKE2)$/);
  });
});
