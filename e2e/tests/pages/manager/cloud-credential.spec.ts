import { test, expect } from '@/support/fixtures';
import {
  cloudCredentialCreatePayloadDO,
  cloudCredentialCreatePayloadAzure,
} from '@/e2e/blueprints/manager/cloud-credential-create-payload';
import { clusterProvDigitalOceanSingleResponse } from '@/e2e/blueprints/manager/digital-ocean-cluster-provisioning-response';
import { machinePoolConfigResponse } from '@/e2e/blueprints/manager/machine-pool-config-response';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import ClusterManagerEditGenericPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/edit/cluster-edit-generic.po';
import CloudCredentialsPagePo from '@/e2e/po/pages/cluster-manager/cloud-credentials.po';
import ClusterManagerCreatePagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create.po';
import ClusterManagerCreateRke2AzurePagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create-rke2-azure.po';

test.describe('Cloud Credential', { tag: ['@manager', '@adminUser', '@needsInfra', '@cloudCredential'] }, () => {
  test.beforeAll(async ({ rancherApi }) => {
    // Clean up test-prefixed Amazon cloud credentials from previous runs
    const result = await rancherApi.getRancherResource('v3', 'cloudcredentials', undefined, 0);

    if (result.body?.pagination?.total > 0) {
      for (const item of result.body.data) {
        if (item.amazonec2credentialConfig && item.name?.startsWith('e2e-test-')) {
          await rancherApi.deleteRancherResource('v3', 'cloudcredentials', item.id, false);
        }
      }
    }
  });

  test('Ensure we validate credentials and show an error when invalid', async ({ login, page, envMeta }) => {
    test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

    await login();

    const name = 'name';
    const access = 'access';
    const secret = 'secret';
    const errorMessage = 'Authentication test failed, please check your credentials';

    const cloudCredentialsPage = new CloudCredentialsPagePo(page);

    await cloudCredentialsPage.goTo();
    await cloudCredentialsPage.waitForPage();
    await cloudCredentialsPage.create();
    await cloudCredentialsPage.createEditCloudCreds().waitForPage();
    await cloudCredentialsPage.createEditCloudCreds().cloudServiceOptions().selectSubTypeByIndex(0).click();
    await cloudCredentialsPage.createEditCloudCreds().waitForPage('type=aws');
    await cloudCredentialsPage.createEditCloudCreds().accessKey().set(access);
    await cloudCredentialsPage.createEditCloudCreds().secretKey().set(secret);
    await cloudCredentialsPage.createEditCloudCreds().nameNsDescription().name().set(name);

    await expect(cloudCredentialsPage.createEditCloudCreds().nameNsDescription().name().input()).toHaveValue(name);

    await cloudCredentialsPage.createEditCloudCreds().saveCreateForm().cruResource().saveOrCreate().click();

    await expect(cloudCredentialsPage.resourceDetail().createEditView().errorBanner()).toContainText(errorMessage);
  });

  test('Ensure we validate credentials and show an error when invalid when creating a credential from the create cluster page', async ({
    login,
    page,
    envMeta,
  }) => {
    test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

    await login();

    const name = 'name';
    const access = 'access';
    const secret = 'secret';
    const errorMessage = 'Authentication test failed, please check your credentials';

    const clusterCreate = new ClusterManagerCreatePagePo(page);

    await clusterCreate.goTo();
    await clusterCreate.waitForPage();
    await clusterCreate.selectCreate(0);
    await expect(clusterCreate.loadingIndicator()).not.toBeAttached({ timeout: 15000 });
    await expect(clusterCreate.rke2PageTitle()).toContainText('Create Amazon EC2');
    await clusterCreate.waitForPage('type=amazonec2&rkeType=rke2');

    const cloudCredentialsPage = new CloudCredentialsPagePo(page);

    await cloudCredentialsPage.createEditCloudCreds().accessKey().set(access);
    await cloudCredentialsPage.createEditCloudCreds().secretKey().set(secret);
    await cloudCredentialsPage.createEditCloudCreds().nameNsDescription().name().set(name);

    await expect(cloudCredentialsPage.createEditCloudCreds().nameNsDescription().name().input()).toHaveValue(name);

    await cloudCredentialsPage.createEditCloudCreds().saveCreateForm().cruResource().saveOrCreate().click();

    await expect(cloudCredentialsPage.resourceDetail().createEditView().errorBanner()).toContainText(errorMessage);
  });

  test('Editing a cluster cloud credential should work with duplicate named cloud credentials', async ({
    login,
    page,
    rancherApi,
    envMeta,
  }) => {
    test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

    await login();

    const credsName = `do-creds-${Date.now()}`;
    const clusterName = `test-cluster-do-${Date.now()}`;
    const machinePoolId = 'dummy-id';
    const doCreatedCloudCredsIds: string[] = [];

    try {
      const cloudCredsToCreate = [
        { name: credsName, token: 'token1' },
        { name: credsName, token: 'token2' },
        { name: `another-${credsName}`, token: 'token3' },
      ];

      for (const cred of cloudCredsToCreate) {
        const resp = await rancherApi.createRancherResource(
          'v3',
          'cloudcredentials',
          JSON.stringify(cloudCredentialCreatePayloadDO(cred.name, cred.token)),
        );

        doCreatedCloudCredsIds.push(resp.body.id);
      }

      const clusterList = new ClusterManagerListPagePo(page);

      await page.route(`/v1/rke-machine-config.cattle.io.digitaloceanconfigs/fleet-default/*`, (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify(machinePoolConfigResponse(clusterName, machinePoolId)),
        });
      });

      await page.route(
        `/v1/rke-machine-config.cattle.io.digitaloceanconfigs/fleet-default/nc-${clusterName}-pool1-${machinePoolId}`,
        (route) => {
          if (route.request().method() === 'PUT') {
            route.fulfill({ status: 200, body: JSON.stringify({}) });
          } else {
            route.continue();
          }
        },
      );

      await page.route(`/v1/provisioning.cattle.io.clusters/fleet-default/${clusterName}`, (route) => {
        if (route.request().method() === 'PUT') {
          route.fulfill({ status: 200, body: JSON.stringify({}) });
        } else {
          route.continue();
        }
      });

      await clusterList.goTo();

      await page.route('/v1/provisioning.cattle.io.clusters?*', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify(
            clusterProvDigitalOceanSingleResponse(
              clusterName,
              doCreatedCloudCredsIds[doCreatedCloudCredsIds.length - 1],
              machinePoolId,
            ),
          ),
        });
      });

      await clusterList.waitForPage();
      await clusterList.editCluster(clusterName);

      const editClusterPage = new ClusterManagerEditGenericPagePo(page, '_', clusterName);

      const selectOptLabel = `${credsName} (${doCreatedCloudCredsIds[1]})`;

      await editClusterPage.cloudCredentialSelect().click();
      await editClusterPage.dropdownOption(selectOptLabel).click();

      const putResponsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes(`/v1/provisioning.cattle.io.clusters/fleet-default/${clusterName}`) &&
          resp.request().method() === 'PUT',
        { timeout: 15000 },
      );

      await editClusterPage.resourceDetail().createEditView().save();
      const putResp = await putResponsePromise;
      const putBody = await putResp.json().catch(() => ({}));

      expect(putBody?.spec?.cloudCredentialSecretName ?? '').toContain(doCreatedCloudCredsIds[1]);
    } finally {
      for (const id of doCreatedCloudCredsIds) {
        await rancherApi.deleteRancherResource('v3', 'cloudcredentials', id, false);
      }
    }
  });

  test('Changing credential environment should change the list of locations when creating an Azure cluster', async ({
    login,
    page,
    rancherApi,
    envMeta,
  }) => {
    test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

    await login();

    const clusterName = `test-cluster-azure-${Date.now()}`;
    const machinePoolId = 'dummy-id';
    const azCreatedCloudCredsIds: string[] = [];

    const cloudCredsToCreate = [
      {
        name: `publicCloud-${Date.now()}`,
        environment: 'AzurePublicCloud',
        subscriptionId: 'testSubscription',
        clientId: 'testClientId',
        clientSecret: 'testClientSecret',
        body: [{ name: 'public', displayName: 'public' }],
      },
      {
        name: `chinaCloud-${Date.now()}`,
        environment: 'AzureChinaCloud',
        subscriptionId: 'testSubscription',
        clientId: 'testClientId',
        clientSecret: 'testClientSecret',
        body: [{ name: 'china', displayName: 'china' }],
      },
      {
        name: `USGov-${Date.now()}`,
        environment: 'AzureUSGovernmentCloud',
        subscriptionId: 'testSubscription',
        clientId: 'testClientId',
        clientSecret: 'testClientSecret',
        body: [{ name: 'USGovernment', displayName: 'USGovernment' }],
      },
    ];

    try {
      for (const cred of cloudCredsToCreate) {
        const resp = await rancherApi.createRancherResource(
          'v3',
          'cloudcredentials',
          JSON.stringify(
            cloudCredentialCreatePayloadAzure(
              cred.name,
              cred.environment,
              cred.subscriptionId,
              cred.clientId,
              cred.clientSecret,
            ),
          ),
        );

        azCreatedCloudCredsIds.push(resp.body.id);
      }

      await page.route(`/v1/rke-machine-config.cattle.io.azureconfigs/fleet-default/*`, (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify(machinePoolConfigResponse(clusterName, machinePoolId)),
        });
      });

      await page.route(`/meta/aksVMSizesV2*`, (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify([
            { Name: 'Standard_B2pls_v2', AcceleratedNetworkingSupported: true, AvailabilityZones: [] },
          ]),
        });
      });

      for (let i = 0; i < azCreatedCloudCredsIds.length; i++) {
        await page.route(
          `/meta/aksLocations?cloudCredentialId=${encodeURIComponent(azCreatedCloudCredsIds[i])}`,
          (route) => {
            route.fulfill({ status: 200, body: JSON.stringify(cloudCredsToCreate[i].body) });
          },
        );
      }

      const clusterList = new ClusterManagerListPagePo(page);
      const azureCreatePage = new ClusterManagerCreateRke2AzurePagePo(page);

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.createCluster();

      await azureCreatePage.gridProviderByName('Azure').click();
      await expect(azureCreatePage.rke2PageTitle()).toContainText('Create Azure');
      await expect(page).toHaveURL(/type=azure&rkeType=rke2/);

      await azureCreatePage.cloudCredentialSelect().click();
      await azureCreatePage.dropdownOption(cloudCredsToCreate[0].name).click();

      const envDisplay = azureCreatePage.environmentDisplay();

      await expect(azureCreatePage.locationSelectedValue()).toHaveText(cloudCredsToCreate[0].body[0].name, {
        useInnerText: true,
      });
      await expect(envDisplay).toHaveText(cloudCredsToCreate[0].environment);

      await azureCreatePage.cloudCredentialSelect().click();
      await azureCreatePage.dropdownOption(cloudCredsToCreate[1].name).click();

      await expect(envDisplay).toHaveText(cloudCredsToCreate[1].environment);
      await expect(azureCreatePage.locationSelectedValue()).toHaveText(cloudCredsToCreate[1].body[0].name, {
        useInnerText: true,
      });

      await azureCreatePage.cloudCredentialSelect().click();
      await azureCreatePage.dropdownOption(cloudCredsToCreate[2].name).click();

      await expect(envDisplay).toHaveText(cloudCredsToCreate[2].environment);
      await expect(azureCreatePage.locationSelectedValue()).toHaveText(cloudCredsToCreate[2].body[0].name, {
        useInnerText: true,
      });
    } finally {
      for (const id of azCreatedCloudCredsIds) {
        await rancherApi.deleteRancherResource('v3', 'cloudcredentials', id, false);
      }
    }
  });
});

test.skip(true, 'Percy snapshot test');
test.describe('Visual Testing', { tag: ['@percy', '@manager', '@adminUser'] }, () => {
  test('display empty creation page', async () => {
    // Upstream Percy snapshot test
  });
});
