import { test, expect } from '@/support/fixtures';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import ClusterManagerEditGenericPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/edit/cluster-edit-generic.po';
import { installFakeClusterRoutes } from '@/e2e/blueprints/nav/fake-cluster';

const fakeProvClusterId = 'some-fake-cluster-id';
const fakeMgmtClusterId = 'some-fake-mgmt-id';

test.describe('Cluster Edit (Fake DO cluster)', { tag: ['@manager', '@adminUser'] }, () => {
  test.beforeEach(async ({ page, login }) => {
    await installFakeClusterRoutes(page, { fakeProvClusterId, fakeMgmtClusterId });
    await login();
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  test('Clearing a registry auth item should retain its authentication ID', async ({ page }) => {
    const clusterList = new ClusterManagerListPagePo(page);

    await clusterList.goTo();
    await clusterList.waitForPage();
    await clusterList.sortableTable().checkLoadingIndicatorNotVisible();
    await clusterList.editCluster(fakeProvClusterId);

    const editCluster = new ClusterManagerEditGenericPagePo(page, '_', fakeProvClusterId);

    await editCluster.clickRegistryTab();
    await editCluster.registryAuthenticationItems().closeArrayListItem(0);
    await editCluster
      .registryAuthenticationField()
      .checkOptionSelected('registryconfig-auth-reg2 (HTTP Basic Auth: aaa)');
  });

  test('documentation link in editing a cluster should open in a new tab', async ({ page }) => {
    const clusterList = new ClusterManagerListPagePo(page);

    await clusterList.goTo();
    await clusterList.waitForPage();
    await clusterList.sortableTable().checkLoadingIndicatorNotVisible();
    await clusterList.editCluster(fakeProvClusterId);

    const editCluster = new ClusterManagerEditGenericPagePo(page, '_', fakeProvClusterId);
    const docLink = editCluster.documentationLink();

    await expect(docLink).toBeVisible();
    await expect(docLink).toHaveAttribute('target', '_blank');
    await expect(docLink).toHaveAttribute(
      'href',
      /ranchermanager\.docs\.rancher\.com\/v[\d.]+\/how-to-guides\/new-user-guides\/launch-kubernetes-with-rancher/,
    );

    // Verify clicking opens the correct docs page in a new tab
    const [popup] = await Promise.all([page.waitForEvent('popup'), docLink.click()]);

    await expect(popup).toHaveURL(
      /ranchermanager\.docs\.rancher\.com\/v[\d.]+\/how-to-guides\/new-user-guides\/launch-kubernetes-with-rancher/,
    );
    await popup.close();
  });
});
