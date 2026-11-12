import { test, expect } from '@/support/fixtures';
import ClusterManagerCreateAKSPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create-aks.po';
import ClusterManagerCreateRke2AzurePagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create-rke2-azure.po';
import { SHORT_TIMEOUT_OPT } from '@/support/timeouts';

const REGION_WITH_AZ = 'East US';
const REGION_WITHOUT_AZ = 'UK West';
const RKE2_REGION_WITHOUT_AZ = 'ukwest';
const RKE2_AZ_WARNING_TEXT =
  'Availability zones are not supported in the selected region. Please select a different region or use an availability set instead.';
const AKS_AZ_WARNING_TEXT =
  'No availability zones are available for the selected region. For the most resiliency it is recommended to select a High Availablity region.';
const AZURE_CLOUD_ENVIRONMENT = 'AzurePublicCloud';
const EXPECTED_EMPTY_AZ_COUNT = 0;

test.describe(
  'Azure Availability Zone Handling in Unsupported Regions',
  { tag: ['@manager', '@adminUser', '@needsInfra', '@cloudCredential'] },
  () => {
    let credId = '';
    const credName = `azure-az-test-${Date.now()}`;

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

      const resp = await rancherApi.createRancherResource('v3', 'cloudcredentials', {
        type: 'cloudCredential',
        name: credName,
        azurecredentialConfig: {
          subscriptionId: envMeta.azureSubscriptionId,
          clientId: envMeta.azureClientId,
          clientSecret: envMeta.azureClientSecret,
          environment: AZURE_CLOUD_ENVIRONMENT,
        },
      });

      credId = resp.body.id;
    });

    test.afterAll(async ({ rancherApi }) => {
      if (credId) {
        await rancherApi.deleteRancherResource('v3', 'cloudcredentials', credId, false);
      }
    });

    test('should clear and disable availability zones in AKS when switching to unsupported region and restore on AZ-capable region', async ({
      page,
      login,
    }) => {
      await login();

      const aksPage = new ClusterManagerCreateAKSPagePo(page);

      await aksPage.goTo();
      await aksPage.waitForPage();

      // Step 1: Select Cloud Credential
      await aksPage.cloudCredentialDropdown().searchInput().click();
      await aksPage.cloudCredentialDropdown().clickOptionWithLabel(credName);

      // Verify default East US region has zones 1, 2, 3 selected
      await expect(aksPage.availabilityZonesSelect().selectedOption()).toHaveCount(3);
      await expect(aksPage.availabilityZonesSelect().selectedOption().nth(0)).toHaveText('zone 1');
      await expect(aksPage.availabilityZonesSelect().selectedOption().nth(1)).toHaveText('zone 2');
      await expect(aksPage.availabilityZonesSelect().selectedOption().nth(2)).toHaveText('zone 3');

      // Step 2: Switch Region to UK West (does not support AZs)
      const ukwestVersionsPromise = page.waitForResponse(
        (resp) => resp.url().includes('meta/aksVersions') && resp.url().includes('ukwest') && resp.status() === 200,
        SHORT_TIMEOUT_OPT,
      );

      await aksPage.regionSelect().searchInput().click();
      await page.getByRole('option', { name: REGION_WITHOUT_AZ }).click();
      await ukwestVersionsPromise;

      // Verify AZ input is cleared and disabled, and warning banner is shown
      await expect(aksPage.availabilityZoneWarningBanner()).toBeVisible();
      await expect(aksPage.availabilityZoneWarningBanner()).toContainText(AKS_AZ_WARNING_TEXT);
      await expect(aksPage.availabilityZonesSelect().selectedOption()).toHaveCount(EXPECTED_EMPTY_AZ_COUNT);
      await expect(aksPage.availabilityZonesSelect().self()).toHaveClass(/disabled/);

      // Step 3: Switch back to East US (AZ-capable)
      const eastusVersionsPromise = page.waitForResponse(
        (resp) => resp.url().includes('meta/aksVersions') && resp.url().includes('eastus') && resp.status() === 200,
        SHORT_TIMEOUT_OPT,
      );

      await aksPage.regionSelect().searchInput().click();
      await page.getByRole('option', { name: REGION_WITH_AZ, exact: true }).click();
      await eastusVersionsPromise;

      // Verify default zones are automatically restored and warning banner is absent
      await expect(aksPage.availabilityZoneWarningBanner()).toBeHidden();
      await expect(aksPage.availabilityZonesSelect().selectedOption()).toHaveCount(3);
      await expect(aksPage.availabilityZonesSelect().selectedOption().nth(0)).toHaveText('zone 1');
    });

    test('should display AZ warning banner and disable input without setting value to 3 in Azure RKE2 for unsupported region', async ({
      page,
      login,
    }) => {
      await login();

      const rke2Page = new ClusterManagerCreateRke2AzurePagePo(page);

      await rke2Page.goTo('type=azure&rkeType=rke2');
      await rke2Page.waitForPage();

      // Step 1: Select Cloud Credential
      await rke2Page.cloudCredentialSelect().getByRole('combobox').click();
      await rke2Page.dropdownOption(credName).click();
      await expect(rke2Page.locationSelect()).toBeVisible(SHORT_TIMEOUT_OPT);

      // Step 2: Select Location ukwest
      await rke2Page.locationSelect().getByRole('combobox').click();
      await rke2Page.dropdownOption(RKE2_REGION_WITHOUT_AZ).click();

      // Step 3: Select Availability Zone radio button
      await rke2Page.availabilityZoneRadio().click();

      // Step 4: Verify warning banner is displayed
      await expect(rke2Page.availabilityZoneWarningBanner()).toBeVisible();
      await expect(rke2Page.availabilityZoneWarningBanner()).toContainText(RKE2_AZ_WARNING_TEXT);

      // Step 5: Verify Availability Zone input is disabled and not set to "3"
      await expect(rke2Page.availabilityZoneSelect()).toHaveClass(/disabled/);
      await expect(rke2Page.availabilityZoneSelectComponent().selectedOption()).toHaveCount(EXPECTED_EMPTY_AZ_COUNT);
    });
  },
);
