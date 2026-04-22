import { test, expect } from '@/support/fixtures';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import ClusterManagerCreateRke2AzurePagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create-rke2-azure.po';
import ClusterManagerDetailRke2AmazonEc2PagePo from '@/e2e/po/detail/provisioning.cattle.io.cluster/cluster-detail-rke2-amazon.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';

/**
 * Running this test will delete all Azure cloud credentials from the target cluster.
 * Requires: AZURE_AKS_SUBSCRIPTION_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
 *
 * Provisioning chain: tests run sequentially and depend on cluster created by first test. This is intentional — cluster provisioning takes 10+ minutes and cannot be repeated per test.
 */
test.describe(
  'Deploy RKE2 cluster using node driver on Azure',
  {
    tag: ['@manager', '@adminUser', '@standardUser', '@jenkins', '@provisioning', '@needsInfra'],
  },
  () => {
    test.beforeEach(async ({ envMeta }) => {
      test.skip(
        !envMeta.azureSubscriptionId,
        'Requires Azure credentials (AZURE_AKS_SUBSCRIPTION_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET)',
      );
    });

    test('can not create an Azure RKE2 cluster if invalid Azure credentials are provided', async ({
      page,
      login,
      rancherApi,
    }) => {
      const credName = rancherApi.createE2EResourceName('az-cred-err');

      await login();

      const clusterList = new ClusterManagerListPagePo(page);
      const createPage = new ClusterManagerCreateRke2AzurePagePo(page);

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.createCluster();
      await createPage.waitForPage();

      await createPage.selectCreate(1);
      await expect(page).toHaveURL(/type=azure&rkeType=rke2/);

      await createPage.nameNsDescription().name().set(credName);
      await createPage.azureEnvironmentSelect().click();
      await createPage.azureDropdownOption('AzurePublicCloud').click();
      await createPage.subscriptionIdInput().fill('bad');
      await createPage.clientIdInput().fill('bad');
      await createPage.clientSecretInput().fill('bad');

      const credCheckResponse = page.waitForResponse(
        (resp) => resp.url().includes('/meta/aksCheckCredentials') && resp.request().method() === 'POST',
      );

      await createPage.saveButton().click();
      const resp = await credCheckResponse;

      expect(resp.status()).toBe(400);

      await expect(createPage.errorBanner()).toBeAttached();
    });

    test('can create a RKE2 cluster using Azure cloud provider', async ({ page, login, rancherApi, envMeta }) => {
      const clusterName = rancherApi.createE2EResourceName('az-create');
      const credName = rancherApi.createE2EResourceName('az-cred');
      let clusterId = '';
      let cloudcredentialId = '';

      await login();

      // Clean up existing Azure cloud credentials
      const creds = await rancherApi.getRancherResource('v3', 'cloudcredentials');

      for (const item of creds.body.data ?? []) {
        if (item.azurecredentialConfig) {
          await rancherApi.deleteRancherResource('v3', 'cloudcredentials', item.id, false);
        }
      }

      // Create cloud credential via API
      const credResp = await rancherApi.createRancherResource('v3', 'cloudcredentials', {
        type: 'cloudcredential',
        metadata: { name: credName },
        azurecredentialConfig: {
          subscriptionId: envMeta.azureSubscriptionId,
          clientId: envMeta.azureClientId,
          clientSecret: envMeta.azureClientSecret,
        },
      });

      expect(credResp.status).toBe(201);
      cloudcredentialId = credResp.body.id;

      const clusterList = new ClusterManagerListPagePo(page);
      const createPage = new ClusterManagerCreateRke2AzurePagePo(page);

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.createCluster();
      await createPage.waitForPage();

      await createPage.selectCreate(1);
      await expect(page).toHaveURL(/type=azure&rkeType=rke2/);

      try {
        const releasesResponse = page.waitForResponse((resp) => resp.url().includes('/v1-rke2-release/releases'));
        const releasesResp = await releasesResponse;

        expect(releasesResp.status()).toBe(200);
        const releasesBody = await releasesResp.json();
        const k8sVersion: string = releasesBody.data[releasesBody.data.length - 1].id;

        await createPage.nameNsDescription().name().set(clusterName);
        await createPage.nameNsDescription().description().set(`${clusterName}-description`);

        await createPage.poolNameInput().clear();
        await expect(createPage.createButton()).toBeDisabled();
        await createPage.poolNameInput().fill('pool1');
        await expect(createPage.createButton()).toBeEnabled();

        await createPage.poolQuantityInput().fill('abc');
        await expect(createPage.createButton()).toBeDisabled();
        await createPage.poolQuantityInput().fill('-1');
        await expect(createPage.createButton()).toBeDisabled();
        await createPage.poolQuantityInput().fill('1');
        await expect(createPage.createButton()).toBeEnabled();

        await createPage.kubernetesVersionSelect().click();
        await createPage.kubernetesVersionOption(k8sVersion).click();

        const createClusterResponse = page.waitForResponse(
          (resp) => resp.url().includes('v1/provisioning.cattle.io.clusters') && resp.request().method() === 'POST',
        );

        await createPage.createButton().click();
        const response = await createClusterResponse;

        expect(response.status()).toBe(201);
        const body = await response.json();

        expect(body.kind).toBe('Cluster');
        expect(body.metadata.name).toBe(clusterName);
        expect(body.spec.kubernetesVersion).toBe(k8sVersion);
        clusterId = body.id;

        await clusterList.waitForPage();
        await expect(clusterList.sortableTable().rowElementWithName(clusterName)).toBeVisible();
      } finally {
        if (clusterId) {
          await rancherApi.deleteRancherResource('v1', 'provisioning.cattle.io.clusters', clusterId, false);
        }
        if (cloudcredentialId) {
          await rancherApi.deleteRancherResource('v3', 'cloudCredentials', cloudcredentialId, false);
        }
      }
    });

    test('can see details of cluster in cluster list', async ({ page, login, rancherApi }) => {
      const clusterName = rancherApi.createE2EResourceName('az-list');

      await login();

      const clusterList = new ClusterManagerListPagePo(page);

      await clusterList.goTo();
      await clusterList.waitForPage();

      await expect(clusterList.sortableTable().rowElementWithName(clusterName)).toBeVisible({ timeout: 300000 });

      await expect(clusterList.list().resourceTable().resourceTableDetails(clusterName, 4)).toContainText('Azure');
      await expect(clusterList.list().resourceTable().resourceTableDetails(clusterName, 4)).toContainText('RKE2');
    });

    test('cluster details page', async ({ page, login, rancherApi }) => {
      const clusterName = rancherApi.createE2EResourceName('az-detail');

      await login();

      const clusterList = new ClusterManagerListPagePo(page);
      const clusterDetails = new ClusterManagerDetailRke2AmazonEc2PagePo(page, '_', clusterName);

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.clusterLink(clusterName).click();
      await expect(page).toHaveURL(/machine-pools/);

      await expect(clusterDetails.tabbedBlock()).toBeVisible();

      await clusterDetails.eventsTab().click();
      await expect(page).toHaveURL(/events/);
    });

    test('can create snapshot', async ({ page, login, rancherApi }) => {
      const clusterName = rancherApi.createE2EResourceName('az-snap');

      await login();

      const clusterList = new ClusterManagerListPagePo(page);
      const clusterDetails = new ClusterManagerDetailRke2AmazonEc2PagePo(page, '_', clusterName);

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.clusterLink(clusterName).click();

      await expect(page).toHaveURL(/machine-pools/);
      await clusterDetails.snapshotsTab().click();
      await expect(page).toHaveURL(/snapshots/);

      await clusterDetails.snapshotsList().clickOnSnapshotNow();

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.clusterLink(clusterName).click();

      await clusterDetails.snapshotsTab().click();
      await expect(page).toHaveURL(/snapshots/);
      await expect(clusterDetails.snapshotsList().checkSnapshotExist(`on-demand-${clusterName}`)).toBeVisible({
        timeout: 300000,
      });
    });

    test('can delete an Azure RKE2 cluster', async ({ page, login, rancherApi }) => {
      const clusterName = rancherApi.createE2EResourceName('az-del');

      await login();

      const clusterList = new ClusterManagerListPagePo(page);
      const promptRemove = new PromptRemove(page);

      await clusterList.goTo();
      await clusterList.waitForPage();

      try {
        const deleteMenu = await clusterList.list().actionMenu(clusterName);

        await deleteMenu.getMenuItem('Delete').click();
        await promptRemove.confirm(clusterName);
        await promptRemove.remove();

        await clusterList.waitForPage();
        await expect(clusterList.sortableTable().rowElementWithName(clusterName)).not.toBeAttached({
          timeout: 300000,
        });
      } finally {
        await rancherApi.deleteRancherResource('v1', 'provisioning.cattle.io.clusters', clusterName, false);
      }
    });
  },
);
