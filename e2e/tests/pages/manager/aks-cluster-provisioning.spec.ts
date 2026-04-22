import { test, expect } from '@/support/fixtures';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import ClusterManagerCreatePagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create.po';
import ClusterManagerCreateAKSPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create-aks.po';

/**
 * Running this test will delete all Azure cloud credentials from the target cluster.
 * Requires: AZURE_AKS_SUBSCRIPTION_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
 */
test.describe(
  'Create AKS cluster',
  { tag: ['@manager', '@adminUser', '@jenkins', '@provisioning', '@needsInfra'] },
  () => {
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
      envMeta,
    }) => {
      const clusterName = rancherApi.createE2EResourceName('akscluster');
      const cloudCredentialName = rancherApi.createE2EResourceName('akscloudcredential');
      let clusterId = '';
      let cloudcredentialId = '';

      await login();

      const creds = await rancherApi.getRancherResource('v3', 'cloudcredentials');

      for (const item of creds.body.data ?? []) {
        if (item.azurecredentialConfig && item.name?.startsWith('e2e-test-')) {
          await rancherApi.deleteRancherResource('v3', 'cloudcredentials', item.id, false);
        }
      }

      const credResp = await rancherApi.createRancherResource('v3', 'cloudcredentials', {
        type: 'cloudcredential',
        metadata: { name: cloudCredentialName },
        azurecredentialConfig: {
          subscriptionId: envMeta.azureSubscriptionId,
          clientId: envMeta.azureClientId,
          clientSecret: envMeta.azureClientSecret,
        },
      });

      expect(credResp.status).toBe(201);
      cloudcredentialId = credResp.body.id ?? '';

      const clusterList = new ClusterManagerListPagePo(page);
      const createPage = new ClusterManagerCreatePagePo(page);
      const aksCreatePage = new ClusterManagerCreateAKSPagePo(page);

      try {
        await clusterList.goTo();
        await clusterList.waitForPage();
        await clusterList.createCluster();
        await createPage.waitForPage();

        await createPage.selectKubeProvider(1);
        await expect(page).toHaveURL(/type=aks&rkeType=rke2/);

        await aksCreatePage.cloudCredentialSelect().selectOption({ label: cloudCredentialName });
        await aksCreatePage.clusterNameInput().fill(clusterName);
        await aksCreatePage.clusterResourceGroup().fill('aks-resource-group');
        await aksCreatePage.dnsPrefixInput().fill('dns-test');

        const createClusterResponse = page.waitForResponse(
          (resp) => resp.url().includes('v3/clusters') && resp.request().method() === 'POST',
        );

        await aksCreatePage.resourceDetail().cruResource().saveOrCreate().click();

        const response = await createClusterResponse;

        expect(response.status()).toBe(201);
        const body = await response.json();

        expect(body.type).toBe('cluster');
        expect(body.name).toBe(clusterName);
        clusterId = body.id;

        await clusterList.waitForPage();
        await expect(clusterList.sortableTable().self()).toBeVisible();

        // Fail early if cloud credentials are bad instead of waiting for a long timeout
        await rancherApi.assertClusterProvisioningNotStuck('v3', clusterId);
      } finally {
        if (clusterId) {
          await rancherApi.deleteRancherResource(
            'v1',
            'provisioning.cattle.io.clusters',
            `fleet-default/${clusterName}`,
            false,
          );
          await rancherApi.deleteRancherResource('v3', 'clusters', clusterId, false);
        }
        if (cloudcredentialId) {
          await rancherApi.deleteRancherResource('v3', 'cloudcredentials', cloudcredentialId, false);
        }
      }
    });

    test('can create an Azure AKS cluster with default values', async ({ page, login, rancherApi, envMeta }) => {
      const clusterName = rancherApi.createE2EResourceName('akscluster2');
      const cloudCredentialName = rancherApi.createE2EResourceName('akscloudcredential2');
      let clusterId = '';
      let cloudcredentialId = '';

      await login();

      const credResp = await rancherApi.createRancherResource('v3', 'cloudcredentials', {
        type: 'cloudcredential',
        metadata: { name: cloudCredentialName },
        azurecredentialConfig: {
          subscriptionId: envMeta.azureSubscriptionId,
          clientId: envMeta.azureClientId,
          clientSecret: envMeta.azureClientSecret,
        },
      });

      expect(credResp.status).toBe(201);
      cloudcredentialId = credResp.body.id ?? '';

      const clusterList = new ClusterManagerListPagePo(page);
      const createPage = new ClusterManagerCreatePagePo(page);
      const aksCreatePage = new ClusterManagerCreateAKSPagePo(page);

      try {
        await clusterList.goTo();
        await clusterList.waitForPage();
        await clusterList.createCluster();
        await createPage.waitForPage();

        await createPage.selectKubeProvider(1);
        await expect(page).toHaveURL(/type=aks&rkeType=rke2/);

        await aksCreatePage.cloudCredentialSelect().selectOption({ label: cloudCredentialName });

        const aksVersionsResponse = page.waitForResponse(
          (resp) => resp.url().includes('/meta/aksVersions') && resp.request().method() === 'GET',
        );
        const versionsResp = await aksVersionsResponse;

        expect(versionsResp.status()).toBe(200);

        await aksCreatePage.clusterNameInput().fill(clusterName);
        await aksCreatePage.clusterResourceGroup().fill('aks-resource-group');
        await aksCreatePage.dnsPrefixInput().fill('dns-test');

        const createClusterResponse = page.waitForResponse(
          (resp) => resp.url().includes('v3/clusters') && resp.request().method() === 'POST',
        );

        await aksCreatePage.resourceDetail().cruResource().saveOrCreate().click();

        const response = await createClusterResponse;

        expect(response.status()).toBe(201);
        const body = await response.json();

        expect(body.type).toBe('cluster');
        expect(body.name).toBe(clusterName);
        expect(body.aksConfig.resourceLocation).toBeDefined();
        clusterId = body.id;

        await clusterList.waitForPage();

        // Fail early if cloud credentials are bad instead of waiting for a long timeout
        await rancherApi.assertClusterProvisioningNotStuck('v3', clusterId);
      } finally {
        if (clusterId) {
          await rancherApi.deleteRancherResource(
            'v1',
            'provisioning.cattle.io.clusters',
            `fleet-default/${clusterName}`,
            false,
          );
          await rancherApi.deleteRancherResource('v3', 'clusters', clusterId, false);
        }
        if (cloudcredentialId) {
          await rancherApi.deleteRancherResource('v3', 'cloudcredentials', cloudcredentialId, false);
        }
      }
    });
  },
);
