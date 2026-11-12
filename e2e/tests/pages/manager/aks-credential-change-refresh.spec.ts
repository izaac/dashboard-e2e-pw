import { test, expect } from '@/support/fixtures';
import ClusterManagerCreateAKSPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create-aks.po';
import { SHORT_TIMEOUT_OPT } from '@/support/timeouts';

const REGION_LABEL_WEST = 'West US 2';
const REGION_PARAM_WEST = 'westus2';
const AZURE_CLOUD_ENVIRONMENT = 'AzurePublicCloud';
const EXPECTED_MIN_OPTIONS_COUNT = 1;

test.describe(
  'AKS Provisioning Credential Change Resource Refresh',
  { tag: ['@manager', '@adminUser', '@needsInfra', '@cloudCredential'] },
  () => {
    let credIdA = '';
    let credIdB = '';
    const credNameA = `aks-cred-a-${Date.now()}`;
    const credNameB = `aks-cred-b-${Date.now()}`;

    test.beforeEach(async ({ envMeta }) => {
      test.skip(
        !envMeta.azureSubscriptionId || !envMeta.azureClientId || !envMeta.azureClientSecret,
        'Requires Azure credentials (AZURE_AKS_SUBSCRIPTION_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET)',
      );
    });

    test.beforeAll(async ({ rancherApi, envMeta }) => {
      if (!envMeta.azureSubscriptionId || !envMeta.azureClientId || !envMeta.azureClientSecret) {
        return;
      }

      // Provision Credential A via Rancher API
      const respA = await rancherApi.createRancherResource('v3', 'cloudcredentials', {
        type: 'cloudCredential',
        name: credNameA,
        azurecredentialConfig: {
          subscriptionId: envMeta.azureSubscriptionId,
          clientId: envMeta.azureClientId,
          clientSecret: envMeta.azureClientSecret,
          environment: AZURE_CLOUD_ENVIRONMENT,
        },
      });

      credIdA = respA.body.id;

      // Provision Credential B via Rancher API
      const respB = await rancherApi.createRancherResource('v3', 'cloudcredentials', {
        type: 'cloudCredential',
        name: credNameB,
        azurecredentialConfig: {
          subscriptionId: envMeta.azureSubscriptionId,
          clientId: envMeta.azureClientId,
          clientSecret: envMeta.azureClientSecret,
          environment: AZURE_CLOUD_ENVIRONMENT,
        },
      });

      credIdB = respB.body.id;
    });

    test.afterAll(async ({ rancherApi }) => {
      if (credIdA) {
        await rancherApi.deleteRancherResource('v3', 'cloudcredentials', credIdA, false);
      }
      if (credIdB) {
        await rancherApi.deleteRancherResource('v3', 'cloudcredentials', credIdB, false);
      }
    });

    test('should re-fetch AKS versions and VM sizes when switching cloud credentials with region selected', async ({
      page,
      login,
    }) => {
      await login();

      const aksPage = new ClusterManagerCreateAKSPagePo(page);

      await aksPage.goTo();
      await aksPage.waitForPage();

      // Step 1: Select Credential A
      await aksPage.cloudCredentialDropdown().searchInput().click();
      await aksPage.cloudCredentialDropdown().clickOptionWithLabel(credNameA);

      // Step 2: Select region West US 2 and wait for initial metadata requests
      const versionsInitPromise = page.waitForResponse(
        (resp) => resp.url().includes('meta/aksVersions') && resp.status() === 200,
        SHORT_TIMEOUT_OPT,
      );
      const vmSizesInitPromise = page.waitForResponse(
        (resp) => resp.url().includes('meta/aksVMSizes') && resp.status() === 200,
        SHORT_TIMEOUT_OPT,
      );

      await aksPage.regionSelect().searchInput().click();
      await aksPage.regionSelect().clickOptionWithLabel(REGION_LABEL_WEST);

      await versionsInitPromise;
      await vmSizesInitPromise;

      // Assert Kubernetes Version and VM Size are populated for Credential A
      await expect(aksPage.kubernetesVersionSelect().selectedOption()).toBeVisible();
      await expect(aksPage.vmSizeSelect().selectedOption()).toBeVisible();

      const initialK8sVersion = await aksPage.kubernetesVersionSelect().selectedOption().innerText();
      const initialVMSize = await aksPage.vmSizeSelect().selectedOption().innerText();

      expect(initialK8sVersion.trim().length).toBeGreaterThan(0);
      expect(initialVMSize.trim().length).toBeGreaterThan(0);

      // Step 3: Switch cloud credential to Credential B with region unchanged
      // PR #18887 ensures this triggers refetching of aksVersions, aksVMSizes, and aksVirtualNetworks
      const versionsRefetchPromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('meta/aksVersions') && resp.url().includes(REGION_PARAM_WEST) && resp.status() === 200,
        SHORT_TIMEOUT_OPT,
      );
      const vmSizesRefetchPromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('meta/aksVMSizes') && resp.url().includes(REGION_PARAM_WEST) && resp.status() === 200,
        SHORT_TIMEOUT_OPT,
      );

      await aksPage.cloudCredentialDropdown().searchInput().click();
      await aksPage.cloudCredentialDropdown().clickOptionWithLabel(credNameB);

      await versionsRefetchPromise;
      await vmSizesRefetchPromise;

      // Verify that after switching credentials, Kubernetes Version and VM Size remain populated
      await expect(aksPage.kubernetesVersionSelect().selectedOption()).toBeVisible();
      await expect(aksPage.vmSizeSelect().selectedOption()).toBeVisible();

      const refetchedK8sVersion = await aksPage.kubernetesVersionSelect().selectedOption().innerText();
      const refetchedVMSize = await aksPage.vmSizeSelect().selectedOption().innerText();

      expect(refetchedK8sVersion.trim().length).toBeGreaterThan(0);
      expect(refetchedVMSize.trim().length).toBeGreaterThan(0);

      // Verify options list in dropdown remains populated
      await aksPage.kubernetesVersionSelect().searchInput().click();
      await expect(aksPage.kubernetesVersionSelect().getOptions().first()).toBeVisible();
      const optionsCount = await aksPage.kubernetesVersionSelect().getOptions().count();

      expect(optionsCount).toBeGreaterThanOrEqual(EXPECTED_MIN_OPTIONS_COUNT);
    });
  },
);
