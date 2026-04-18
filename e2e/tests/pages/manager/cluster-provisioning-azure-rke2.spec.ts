import { test, expect } from '@/support/fixtures';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import ClusterManagerCreatePagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create.po';
import { PromptRemove } from '@/e2e/po/prompts/promptRemove.po';

/**
 * Running this test will delete all Azure cloud credentials from the target cluster.
 * Requires: AZURE_AKS_SUBSCRIPTION_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
 */
test.describe(
  'Deploy RKE2 cluster using node driver on Azure',
  {
    tag: ['@manager', '@adminUser', '@standardUser', '@jenkins', '@provisioning'],
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
      const credName = rancherApi.createE2EResourceName('azurecloudcredential');

      await login();

      const clusterList = new ClusterManagerListPagePo(page);
      const createPage = new ClusterManagerCreatePagePo(page);

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.createCluster();
      await createPage.waitForPage();

      // Select Azure RKE2 provider (index 1 = "Create" tab)
      await createPage.selectCreate(1);
      await expect(page).toHaveURL(/type=azure&rkeType=rke2/);

      // Fill cloud credential form with invalid values
      await page.getByTestId('name-ns-description').locator('input[placeholder*="name"]').first().fill(credName);
      await page.locator('[data-testid="azure-environment"]').click();
      await page.locator('.vs__dropdown-option').filter({ hasText: 'AzurePublicCloud' }).click();
      await page.getByTestId('subscriptionId').fill('bad');
      await page.getByTestId('clientId').fill('bad');
      await page.getByTestId('clientSecret').fill('bad');

      // Submit and expect credential check to fail
      const credCheckResponse = page.waitForResponse(
        (resp) => resp.url().includes('/meta/aksCheckCredentials') && resp.request().method() === 'POST',
      );

      await page.getByRole('button', { name: /save/i }).click();
      const resp = await credCheckResponse;

      expect(resp.status()).toBe(400);

      // Error banner must appear; provisioning form must remain hidden
      await expect(page.locator('.banner.banner-danger')).toBeAttached();
    });

    test('can create a RKE2 cluster using Azure cloud provider', async ({ page, login, rancherApi, envMeta }) => {
      const clusterName = rancherApi.createE2EResourceName('rke2azure');
      const credName = rancherApi.createE2EResourceName('azurecloudcredential');
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
      const createPage = new ClusterManagerCreatePagePo(page);

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.createCluster();
      await createPage.waitForPage();

      await createPage.selectCreate(1);
      await expect(page).toHaveURL(/type=azure&rkeType=rke2/);

      try {
        // Get latest RKE2 kubernetes version
        const releasesResponse = page.waitForResponse((resp) => resp.url().includes('/v1-rke2-release/releases'));
        const releasesResp = await releasesResponse;

        expect(releasesResp.status()).toBe(200);
        const releasesBody = await releasesResp.json();
        const k8sVersion: string = releasesBody.data[releasesBody.data.length - 1].id;

        // Fill cluster name and description
        await page.getByTestId('name-ns-description').locator('input[placeholder*="name"]').first().fill(clusterName);
        await page
          .getByTestId('name-ns-description')
          .locator('input[placeholder*="description"]')
          .fill(`${clusterName}-description`);

        // Validate pool name (required)
        await page.locator('[data-testid="pool-name-input"]').clear();
        await expect(page.getByRole('button', { name: /create/i })).toBeDisabled();
        await page.locator('[data-testid="pool-name-input"]').fill('pool1');
        await expect(page.getByRole('button', { name: /create/i })).toBeEnabled();

        // Validate pool quantity must be positive number
        await page.locator('[data-testid="pool-quantity-input"]').fill('abc');
        await expect(page.getByRole('button', { name: /create/i })).toBeDisabled();
        await page.locator('[data-testid="pool-quantity-input"]').fill('-1');
        await expect(page.getByRole('button', { name: /create/i })).toBeDisabled();
        await page.locator('[data-testid="pool-quantity-input"]').fill('1');
        await expect(page.getByRole('button', { name: /create/i })).toBeEnabled();

        // Select kubernetes version
        await page.locator('[data-testid="kubernetes-version-select"]').click();
        await page.locator('.vs__dropdown-option').filter({ hasText: k8sVersion }).click();

        // Create cluster and verify response
        const createClusterResponse = page.waitForResponse(
          (resp) => resp.url().includes('v1/provisioning.cattle.io.clusters') && resp.request().method() === 'POST',
        );

        await page.getByRole('button', { name: /create/i }).click();
        const response = await createClusterResponse;

        expect(response.status()).toBe(201);
        const body = await response.json();

        expect(body.kind).toBe('Cluster');
        expect(body.metadata.name).toBe(clusterName);
        expect(body.spec.kubernetesVersion).toBe(k8sVersion);
        clusterId = body.id;

        await clusterList.waitForPage();

        // Cluster should appear as reconciling or updating
        const stateCell = clusterList.sortableTable().self().locator(`text=${clusterName}`).locator('../..');

        await expect(stateCell).toBeVisible();
      } finally {
        if (clusterId) {
          await rancherApi.deleteRancherResource('v1', 'provisioning.cattle.io.clusters', clusterId, false);
        }
        if (cloudcredentialId) {
          await rancherApi.deleteRancherResource('v3', 'cloudCredentials', cloudcredentialId, false);
        }
      }
    });

    test('can see details of cluster in cluster list', async ({ page, login, rancherApi, envMeta }) => {
      const clusterName = rancherApi.createE2EResourceName('rke2azure');

      await login();

      const clusterList = new ClusterManagerListPagePo(page);

      await clusterList.goTo();
      await clusterList.waitForPage();

      // Wait for cluster to transition through states
      await expect(clusterList.sortableTable().self().locator(`text=${clusterName}`)).toBeVisible({ timeout: 300000 });

      // Check provider and provider sub-type cells
      const row = clusterList.sortableTable().self().locator(`tr:has-text("${clusterName}")`);

      await expect(row.locator('[data-label="Provider"]')).toContainText('Azure');
      await expect(row.locator('[data-label="Provider"]')).toContainText('RKE2');
    });

    test('cluster details page', async ({ page, login, rancherApi }) => {
      const clusterName = rancherApi.createE2EResourceName('rke2azure');

      await login();

      const clusterList = new ClusterManagerListPagePo(page);

      await clusterList.goTo();
      await clusterList.waitForPage();

      // Navigate to cluster details
      await clusterList.list().name(clusterName).click();
      await expect(page).toHaveURL(/machine-pools/);

      // Machine pools tab: pool status
      await expect(page.locator('[data-testid="tabbed-block"]')).toBeVisible();

      // Events tab
      await page.locator('[data-testid="btn-events"]').click();
      await expect(page).toHaveURL(/events/);
    });

    test('can create snapshot', async ({ page, login, rancherApi }) => {
      const clusterName = rancherApi.createE2EResourceName('rke2azure');

      await login();

      const clusterList = new ClusterManagerListPagePo(page);

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.goToDetailsPage(clusterName, '.cluster-link a');

      await expect(page).toHaveURL(/machine-pools/);
      await page.locator('[data-testid="btn-snapshots"]').click();
      await expect(page).toHaveURL(/snapshots/);

      // Snapshot on demand
      await page.locator('[data-testid="sortable-table-list-container"] [data-testid="snapshot-now-button"]').click();

      // Navigate back and wait for active state, then verify snapshot appears
      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.goToDetailsPage(clusterName, '.cluster-link a');

      await page.locator('[data-testid="btn-snapshots"]').click();
      await expect(page).toHaveURL(/snapshots/);
      await expect(page.locator(`text=on-demand-${clusterName}`)).toBeVisible({ timeout: 300000 });
    });

    test('can delete an Azure RKE2 cluster', async ({ page, login, rancherApi }) => {
      const clusterName = rancherApi.createE2EResourceName('rke2azure');

      await login();

      const clusterList = new ClusterManagerListPagePo(page);
      const promptRemove = new PromptRemove(page);

      await clusterList.goTo();
      await clusterList.waitForPage();

      await clusterList.list().actionMenu(clusterName).getMenuItem('Delete').click();
      await promptRemove.confirm(clusterName);
      await promptRemove.remove();

      await clusterList.waitForPage();
      await expect(clusterList.sortableTable().self().locator(`text=${clusterName}`)).not.toBeAttached({
        timeout: 300000,
      });
    });
  },
);
