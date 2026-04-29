import { test, expect } from '@/support/fixtures';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import ClusterManagerCreateAKSPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create-aks.po';
import * as aksDefaultSettings from '@/e2e/blueprints/cluster_management/aks-default-settings';
import { SHORT_TIMEOUT_OPT } from '@/support/utils/timeouts';
import { LONG } from '@/support/timeouts';

const aksSettings = {
  resourceLocation: aksDefaultSettings.DEFAULT_REGION,
  resourceGroup: 'aks-resource-group',
  dnsPrefix: 'dns-test',
};

/**
 * Running this test will delete all Azure cloud credentials from the target cluster.
 * Requires: AZURE_AKS_SUBSCRIPTION_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
 */
test.describe(
  'Create AKS cluster',
  { tag: ['@manager', '@adminUser', '@jenkins', '@provisioning', '@needsInfra'] },
  () => {
    test.beforeAll(async ({ rancherApi }) => {
      // Clean stale e2e AKS clusters — delete v3 cluster objects first so the
      // controller stops referencing their cloud credentials
      const clusters = await rancherApi.getRancherResource('v3', 'clusters', undefined, 0);

      if (clusters.body?.data) {
        for (const c of clusters.body.data) {
          if (c.name?.startsWith('e2e-test-') && c.aksConfig) {
            await rancherApi.deleteRancherResource('v3', 'clusters', c.id, false);
          }
        }
      }

      // Also clean provisioning objects that may linger after v3 deletion
      const provClusters = await rancherApi.getRancherResource('v1', 'provisioning.cattle.io.clusters', undefined, 0);

      if (provClusters.body?.data) {
        for (const c of provClusters.body.data) {
          if (c.metadata?.name?.startsWith('e2e-test-') && c.spec?.aksConfig) {
            await rancherApi.deleteRancherResource(
              'v1',
              'provisioning.cattle.io.clusters',
              `fleet-default/${c.metadata.name}`,
              false,
            );
          }
        }
      }

      // Wait for controller to settle after cluster deletion
      await new Promise((r) => setTimeout(r, 5_000));

      // Clean stale e2e Azure cloud credentials (safe now that clusters are gone)
      const creds = await rancherApi.getRancherResource('v3', 'cloudcredentials', undefined, 0);

      if (creds.body?.data) {
        for (const item of creds.body.data) {
          if (item.azurecredentialConfig && item.name?.startsWith('e2e-test-')) {
            await rancherApi.deleteRancherResource('v3', 'cloudcredentials', item.id, false);
          }
        }
      }

      // Let Rancher store settle after credential cleanup
      await new Promise((r) => setTimeout(r, 5_000));
    });

    test('can create an Azure AKS cluster by just filling in the mandatory fields', async ({
      page,
      login,
      rancherApi,
      envMeta,
    }) => {
      test.skip(
        !envMeta.azureSubscriptionId || !envMeta.azureClientId || !envMeta.azureClientSecret,
        'Requires Azure credentials (AZURE_AKS_SUBSCRIPTION_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET)',
      );

      await login();

      const clusterName = rancherApi.createE2EResourceName('akscluster');
      const credName = rancherApi.createE2EResourceName('akscloudcredential');
      const clusterList = new ClusterManagerListPagePo(page);
      const aksCreatePage = new ClusterManagerCreateAKSPagePo(page);
      let cloudCredId = '';
      let clusterId = '';

      try {
        // Navigate to AKS create page
        await clusterList.goTo();
        await clusterList.waitForPage();
        await clusterList.createCluster();
        await aksCreatePage.selectKubeProvider(1);
        await expect(aksCreatePage.loadingIndicator()).not.toBeAttached(SHORT_TIMEOUT_OPT);
        await expect(aksCreatePage.rke2PageTitle()).toContainText('Create Azure AKS');
        await aksCreatePage.waitForPage();

        // Create cloud credential inline — SelectCredential only lists
        // credentials that existed before page load
        const cloudCredForm = aksCreatePage.cloudCredentialsForm();

        await cloudCredForm.nameNsDescription().name().set(credName);
        await cloudCredForm.subscriptionId().set(envMeta.azureSubscriptionId!);
        await cloudCredForm.clientId().set(envMeta.azureClientId!);
        await cloudCredForm.clientSecret().set(envMeta.azureClientSecret!);

        const credCreatePromise = page.waitForResponse(
          (resp) => resp.url().includes('/v3/cloudcredentials') && resp.request().method() === 'POST',
          SHORT_TIMEOUT_OPT,
        );
        const pageLoadPromise = page.waitForResponse(
          (resp) => resp.url().includes('/v1/management.cattle.io.users') && resp.request().method() === 'GET',
          { timeout: LONG },
        );

        await cloudCredForm.saveCreateForm().cruResource().saveOrCreate().click();
        const credResp = await credCreatePromise;

        expect(credResp.status()).toBe(201);
        const credBody = await credResp.json();

        cloudCredId = credBody.id;

        await pageLoadPromise;
        await expect(aksCreatePage.loadingIndicator()).not.toBeAttached(SHORT_TIMEOUT_OPT);
        await aksCreatePage.waitForPage();

        // Fill mandatory fields
        await aksCreatePage.getClusterName().set(clusterName);
        await aksCreatePage.clusterResourceGroup().fill(aksSettings.resourceGroup);
        await aksCreatePage.dnsPrefixInput().fill(aksSettings.dnsPrefix);

        const clusterCreatePromise = page.waitForResponse(
          (resp) => resp.url().includes('v3/clusters') && resp.request().method() === 'POST',
          SHORT_TIMEOUT_OPT,
        );

        await aksCreatePage.resourceDetail().cruResource().saveOrCreate().click();
        const clusterResp = await clusterCreatePromise;

        expect(clusterResp.status()).toBe(201);
        const clusterBody = await clusterResp.json();

        expect(clusterBody).toHaveProperty('type', 'cluster');
        expect(clusterBody).toHaveProperty('name', clusterName);
        clusterId = clusterBody.id;

        await clusterList.waitForPage();
        await expect(clusterList.list().state(clusterName)).toContainText(/Waiting|Provisioning/);
      } finally {
        // Delete cluster FIRST so the AKS controller can use the credential during deprovision
        if (clusterId) {
          await rancherApi.deleteRancherResource('v3', 'clusters', clusterId, false);
          await rancherApi.deleteRancherResource(
            'v1',
            'provisioning.cattle.io.clusters',
            `fleet-default/${clusterName}`,
            false,
          );
        }
        if (cloudCredId) {
          await rancherApi.deleteRancherResource('v3', 'cloudcredentials', cloudCredId, false);
        }
      }
    });

    test('can create an Azure AKS cluster with default values', async ({ page, login, rancherApi, envMeta }) => {
      test.skip(
        !envMeta.azureSubscriptionId || !envMeta.azureClientId || !envMeta.azureClientSecret,
        'Requires Azure credentials (AZURE_AKS_SUBSCRIPTION_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET)',
      );

      await login();

      const clusterName = rancherApi.createE2EResourceName('akscluster2');
      const credName = rancherApi.createE2EResourceName('akscloudcredential2');
      const clusterList = new ClusterManagerListPagePo(page);
      const aksCreatePage = new ClusterManagerCreateAKSPagePo(page);
      let cloudCredId = '';
      let clusterId = '';

      try {
        // Navigate to AKS create page
        await clusterList.goTo();
        await clusterList.waitForPage();
        await clusterList.createCluster();
        await aksCreatePage.selectKubeProvider(1);
        await expect(aksCreatePage.loadingIndicator()).not.toBeAttached(SHORT_TIMEOUT_OPT);
        await expect(aksCreatePage.rke2PageTitle()).toContainText('Create Azure AKS');
        await aksCreatePage.waitForPage();

        // Create cloud credential inline
        const cloudCredForm = aksCreatePage.cloudCredentialsForm();

        await cloudCredForm.nameNsDescription().name().set(credName);
        await cloudCredForm.subscriptionId().set(envMeta.azureSubscriptionId!);
        await cloudCredForm.clientId().set(envMeta.azureClientId!);
        await cloudCredForm.clientSecret().set(envMeta.azureClientSecret!);

        const credCreatePromise = page.waitForResponse(
          (resp) => resp.url().includes('/v3/cloudcredentials') && resp.request().method() === 'POST',
          SHORT_TIMEOUT_OPT,
        );
        const pageLoadPromise = page.waitForResponse(
          (resp) => resp.url().includes('/v1/management.cattle.io.users') && resp.request().method() === 'GET',
          { timeout: LONG },
        );

        await cloudCredForm.saveCreateForm().cruResource().saveOrCreate().click();
        const credResp = await credCreatePromise;

        expect(credResp.status()).toBe(201);
        const credBody = await credResp.json();

        cloudCredId = credBody.id;

        await pageLoadPromise;
        await expect(aksCreatePage.loadingIndicator()).not.toBeAttached(SHORT_TIMEOUT_OPT);
        await aksCreatePage.waitForPage();

        // Verify defaults — region dropdown shows display name (e.g. "East US"), not API value
        await expect(aksCreatePage.regionSelect().self().locator('.vs__selected')).toBeVisible();

        // Fill mandatory fields and create
        await aksCreatePage.getClusterName().set(clusterName);
        await aksCreatePage.clusterResourceGroup().fill(aksSettings.resourceGroup);
        await aksCreatePage.dnsPrefixInput().fill(aksSettings.dnsPrefix);

        const clusterCreatePromise = page.waitForResponse(
          (resp) => resp.url().includes('v3/clusters') && resp.request().method() === 'POST',
          SHORT_TIMEOUT_OPT,
        );

        await aksCreatePage.resourceDetail().cruResource().saveOrCreate().click();
        const clusterResp = await clusterCreatePromise;

        expect(clusterResp.status()).toBe(201);
        const clusterBody = await clusterResp.json();

        expect(clusterBody).toHaveProperty('type', 'cluster');
        expect(clusterBody).toHaveProperty('name', clusterName);
        expect(clusterBody.aksConfig.resourceLocation).toBe(aksSettings.resourceLocation);
        clusterId = clusterBody.id;

        await clusterList.waitForPage();
        await expect(clusterList.list().state(clusterName)).toContainText(/Waiting|Provisioning/);
      } finally {
        // Delete cluster FIRST so the AKS controller can use the credential during deprovision
        if (clusterId) {
          await rancherApi.deleteRancherResource('v3', 'clusters', clusterId, false);
          await rancherApi.deleteRancherResource(
            'v1',
            'provisioning.cattle.io.clusters',
            `fleet-default/${clusterName}`,
            false,
          );
        }
        if (cloudCredId) {
          await rancherApi.deleteRancherResource('v3', 'cloudcredentials', cloudCredId, false);
        }
      }
    });
  },
);
