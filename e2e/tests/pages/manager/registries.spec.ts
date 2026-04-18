import { test, expect } from '@/support/fixtures';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import ClusterManagerCreateRke2CustomPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create-rke2-custom.po';
import {
  machineSelectorConfigPayload,
  registriesWithSecretPayload,
} from '@/e2e/blueprints/manager/registries-rke2-payload';

const registryHost = 'docker.io';
const registryAuthHost = 'a.registry.com';

test.describe('Registries for RKE2', { tag: ['@manager', '@adminUser'] }, () => {
  test('Show Advanced should be decoupled from Enable cluster scoped container registry checkbox', async ({
    login,
    page,
    rancherApi,
  }) => {
    await login();

    const clusterList = new ClusterManagerListPagePo(page);
    const createPage = new ClusterManagerCreateRke2CustomPagePo(page);

    await clusterList.goTo();
    await clusterList.checkIsCurrentPage();
    await clusterList.createCluster();

    await expect(page).toHaveURL(/provisioning\.cattle\.io\.cluster\/create/);
    await createPage.selectCustom(0);

    await createPage.clusterConfigurationTabs().clickTabWithSelector('li#registry');

    const version = await rancherApi.getRancherVersion();

    if (version.RancherPrime !== 'true') {
      await createPage.registries().enableRegistryCheckbox().set();
    }

    await createPage.registries().enableRegistryCheckbox().isChecked();
    await expect(createPage.registries().showAdvanced()).toBeVisible();

    await createPage.registries().enableRegistryCheckbox().set();
    await createPage.registries().enableRegistryCheckbox().isNotChecked();
    await expect(createPage.registries().showAdvanced()).toBeVisible();
  });

  test('HTTP Basic Auth: Should send the correct payload to the server', async ({ login, page, rancherApi }) => {
    const clusterName = rancherApi.createE2EResourceName('cluster');

    await login();

    const clusterList = new ClusterManagerListPagePo(page);
    const createPage = new ClusterManagerCreateRke2CustomPagePo(page);

    await clusterList.goTo();
    await clusterList.checkIsCurrentPage();
    await clusterList.createCluster();

    await expect(page).toHaveURL(/provisioning\.cattle\.io\.cluster\/create/);
    await createPage.selectCustom(0);

    const secretResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('v1/secrets/fleet-default') && resp.request().method() === 'POST',
      { timeout: 15000 },
    );
    const clusterResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('v1/provisioning.cattle.io.clusters') && resp.request().method() === 'POST',
      { timeout: 15000 },
    );

    await createPage.nameNsDescription().name().set(clusterName);

    await createPage.clusterConfigurationTabs().clickTabWithSelector('li#registry');

    const version = await rancherApi.getRancherVersion();

    if (version.RancherPrime !== 'true') {
      await createPage.registries().enableRegistryCheckbox().set();
    }

    await createPage.registries().enableRegistryCheckbox().isChecked();
    await createPage.registries().addRegistryHost(registryHost);
    await createPage.registries().clickShowAdvanced();

    await createPage.registries().registryConfigs().registryAuthHost(0).self().scrollIntoViewIfNeeded();
    await createPage.registries().registryConfigs().addRegistryAuthHost(0, registryAuthHost);
    await createPage.registries().registryConfigs().registryAuthSelectOrCreate(0).waitForNotLoading();
    await createPage
      .registries()
      .registryConfigs()
      .registryAuthSelectOrCreate(0)
      .createBasicAuth('test-user', 'test-pass');

    await createPage.create();

    const secretResponse = await secretResponsePromise;

    expect(secretResponse.status()).toBe(201);
    const secretBody = await secretResponse.json();
    const registrySecret = secretBody.metadata?.name;

    const clusterResponse = await clusterResponsePromise;

    expect(clusterResponse.status()).toBe(201);
    const clusterReqBody = clusterResponse.request().postDataJSON();
    const createdClusterBody = await clusterResponse.json();

    expect(clusterReqBody.spec.rkeConfig.machineSelectorConfig).toEqual(machineSelectorConfigPayload(registryHost));
    expect(clusterReqBody.spec.rkeConfig.registries).toEqual(
      registriesWithSecretPayload(registryAuthHost, registrySecret),
    );
    expect(clusterReqBody.spec.rkeConfig.registries.configs[registryHost]).toBeUndefined();

    // Cleanup
    const createdClusterName = createdClusterBody.metadata?.name;

    if (createdClusterName) {
      await rancherApi.deleteRancherResource(
        'v1',
        'provisioning.cattle.io.clusters/fleet-default',
        createdClusterName,
        false,
      );
    }
    if (registrySecret) {
      await rancherApi.deleteRancherResource('v1', 'secrets/fleet-default', registrySecret, false);
    }
  });

  test('RKE Auth: Should send the correct payload to the server', async ({ login, page, rancherApi }) => {
    const clusterName = rancherApi.createE2EResourceName('cluster2');

    await login();

    const clusterList = new ClusterManagerListPagePo(page);
    const createPage = new ClusterManagerCreateRke2CustomPagePo(page);

    await clusterList.goTo();
    await clusterList.checkIsCurrentPage();
    await clusterList.createCluster();

    await expect(page).toHaveURL(/provisioning\.cattle\.io\.cluster\/create/);
    await createPage.selectCustom(0);

    const secretResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('v1/secrets/fleet-default') && resp.request().method() === 'POST',
      { timeout: 15000 },
    );
    const clusterResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('v1/provisioning.cattle.io.clusters') && resp.request().method() === 'POST',
      { timeout: 15000 },
    );

    await createPage.nameNsDescription().name().set(clusterName);

    await createPage.clusterConfigurationTabs().clickTabWithSelector('li#registry');

    const version = await rancherApi.getRancherVersion();

    if (version.RancherPrime !== 'true') {
      await createPage.registries().enableRegistryCheckbox().set();
    }

    await createPage.registries().enableRegistryCheckbox().isChecked();
    await createPage.registries().addRegistryHost(registryHost);
    await createPage.registries().advancedToggle().scrollIntoViewIfNeeded();
    await createPage.registries().registryAuthSelector().createRKEAuth('testuser', 'testpassword');

    await createPage.create();

    const secretResponse = await secretResponsePromise;

    expect(secretResponse.status()).toBe(201);
    const secretBody = await secretResponse.json();
    const secretReqBody = secretResponse.request().postDataJSON();
    const registrySecret = secretBody.metadata?.name;

    expect(secretReqBody.type).toBe('rke.cattle.io/auth-config');
    expect(secretReqBody.data?.auth).toBe('dGVzdHVzZXI6dGVzdHBhc3N3b3Jk');
    expect(secretReqBody.data?.username).toBeUndefined();
    expect(secretReqBody.data?.password).toBeUndefined();

    const clusterResponse = await clusterResponsePromise;

    expect(clusterResponse.status()).toBe(201);
    const clusterReqBody = clusterResponse.request().postDataJSON();
    const createdClusterBody = await clusterResponse.json();

    expect(clusterReqBody.spec.rkeConfig.machineSelectorConfig).toEqual(machineSelectorConfigPayload(registryHost));
    expect(clusterReqBody.spec.rkeConfig.registries).toEqual(registriesWithSecretPayload(registryHost, registrySecret));

    // Cleanup
    const createdClusterName = createdClusterBody.metadata?.name;

    if (createdClusterName) {
      await rancherApi.deleteRancherResource(
        'v1',
        'provisioning.cattle.io.clusters/fleet-default',
        createdClusterName,
        false,
      );
    }
    if (registrySecret) {
      await rancherApi.deleteRancherResource('v1', 'secrets/fleet-default', registrySecret, false);
    }
  });
});
