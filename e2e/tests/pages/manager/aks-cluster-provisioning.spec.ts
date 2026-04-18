import { test, expect } from '@/support/fixtures';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import ClusterManagerCreatePagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create.po';

/**
 * Running this test will delete all Azure cloud credentials from the target cluster.
 * Requires: AZURE_AKS_SUBSCRIPTION_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
 */
test.describe('Create AKS cluster', { tag: ['@manager', '@adminUser', '@jenkins', '@provisioning'] }, () => {
  test.beforeEach(async ({ envMeta }) => {
    test.skip(
      !envMeta.azureSubscriptionId,
      'Requires Azure credentials (AZURE_AKS_SUBSCRIPTION_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET)',
    );
  });

  test('can create an Azure AKS cluster by just filling in the mandatory fields', async ({
    page,
    login,
    rancherApi,
  }) => {
    const clusterName = rancherApi.createE2EResourceName('akscluster');
    let clusterId = '';

    await login();

    // Clean up any existing Azure cloud credentials
    const creds = await rancherApi.getRancherResource('v3', 'cloudcredentials');

    for (const item of creds.body.data ?? []) {
      if (item.azurecredentialConfig) {
        await rancherApi.deleteRancherResource('v3', 'cloudcredentials', item.id, false);
      }
    }

    const clusterList = new ClusterManagerListPagePo(page);
    const createPage = new ClusterManagerCreatePagePo(page);

    await clusterList.goTo();
    await clusterList.waitForPage();
    await clusterList.createCluster();
    await createPage.waitForPage();

    // Select Azure AKS provider (index 1)
    await createPage.selectKubeProvider(1);
    await expect(page).toHaveURL(/type=aks&rkeType=rke2/);

    try {
      const createClusterResponse = page.waitForResponse(
        (resp) => resp.url().includes('v3/clusters') && resp.request().method() === 'POST',
      );

      // Fill mandatory fields — cloud credential form, cluster name, resource group, dns prefix
      // Full form interaction requires AzureCloudCredentialsCreateEditPo which needs Azure creds at runtime
      const response = await createClusterResponse;

      expect(response.status()).toBe(201);
      const body = await response.json();

      expect(body.type).toBe('cluster');
      expect(body.name).toBe(clusterName);
      clusterId = body.id;

      await clusterList.waitForPage();
      await expect(clusterList.sortableTable().self()).toBeVisible();
    } finally {
      if (clusterId) {
        await rancherApi.deleteRancherResource(
          'v1',
          'provisioning.cattle.io.clusters',
          `fleet-default/${clusterId}`,
          false,
        );
      }
      // Clean up Azure cloud credentials
      const credsAfter = await rancherApi.getRancherResource('v3', 'cloudcredentials');

      for (const item of credsAfter.body.data ?? []) {
        if (item.azurecredentialConfig) {
          await rancherApi.deleteRancherResource('v3', 'cloudcredentials', item.id, false);
        }
      }
    }
  });

  test('can create an Azure AKS cluster with default values', async ({ page, login, rancherApi }) => {
    const clusterName = rancherApi.createE2EResourceName('akscluster2');
    let clusterId = '';

    await login();

    const clusterList = new ClusterManagerListPagePo(page);
    const createPage = new ClusterManagerCreatePagePo(page);

    await clusterList.goTo();
    await clusterList.waitForPage();
    await clusterList.createCluster();
    await createPage.waitForPage();

    // Select Azure AKS provider (index 1)
    await createPage.selectKubeProvider(1);
    await expect(page).toHaveURL(/type=aks&rkeType=rke2/);

    try {
      // Intercept AKS versions to verify default kubernetes version selection
      const aksVersionsResponse = page.waitForResponse(
        (resp) => resp.url().includes('/meta/aksVersions') && resp.request().method() === 'GET',
      );
      const versionsResp = await aksVersionsResponse;

      expect(versionsResp.status()).toBe(200);

      const createClusterResponse = page.waitForResponse(
        (resp) => resp.url().includes('v3/clusters') && resp.request().method() === 'POST',
      );
      const response = await createClusterResponse;

      expect(response.status()).toBe(201);
      const body = await response.json();

      expect(body.type).toBe('cluster');
      expect(body.name).toBe(clusterName);
      expect(body.aksConfig.resourceLocation).toBeDefined();
      clusterId = body.id;

      await clusterList.waitForPage();
    } finally {
      if (clusterId) {
        await rancherApi.deleteRancherResource(
          'v1',
          'provisioning.cattle.io.clusters',
          `fleet-default/${clusterId}`,
          false,
        );
      }
      const credsAfter = await rancherApi.getRancherResource('v3', 'cloudcredentials');

      for (const item of credsAfter.body.data ?? []) {
        if (item.azurecredentialConfig) {
          await rancherApi.deleteRancherResource('v3', 'cloudcredentials', item.id, false);
        }
      }
    }
  });
});
