import { test, expect } from '@/support/fixtures';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import ClusterManagerCreateEKSPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create-eks.po';

import * as eksDefaultSettings from '@/e2e/blueprints/cluster_management/eks-default-settings';
import { SHORT_TIMEOUT_OPT } from '@/support/utils/timeouts';

const eksSettings = {
  eksRegion: eksDefaultSettings.DEFAULT_REGION,
  nodegroupName: eksDefaultSettings.DEFAULT_NODE_GROUP_CONFIG.nodegroupName,
  nodeRole: eksDefaultSettings.DEFAULT_NODE_GROUP_CONFIG.nodeRole,
  desiredSize: eksDefaultSettings.DEFAULT_NODE_GROUP_CONFIG.desiredSize,
  maxSize: eksDefaultSettings.DEFAULT_NODE_GROUP_CONFIG.maxSize,
  minSize: eksDefaultSettings.DEFAULT_NODE_GROUP_CONFIG.minSize,
  diskSize: eksDefaultSettings.DEFAULT_NODE_GROUP_CONFIG.diskSize,
  instanceType: eksDefaultSettings.DEFAULT_NODE_GROUP_CONFIG.instanceType,
  publicAccess: eksDefaultSettings.DEFAULT_EKS_CONFIG.publicAccess,
  privateAccess: eksDefaultSettings.DEFAULT_EKS_CONFIG.privateAccess,
  launchTemplate: 'Default (One will be created automatically)',
};

test.describe('Create EKS cluster', { tag: ['@manager', '@adminUser', '@provisioning', '@needsInfra'] }, () => {
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

  test('can create an Amazon EKS cluster by just filling in the mandatory fields', async ({
    login,
    page,
    rancherApi,
    envMeta,
  }) => {
    test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

    await login();

    const clusterName = rancherApi.createE2EResourceName('ekscluster');
    const credName = rancherApi.createE2EResourceName('ekscloudcredential');
    const clusterList = new ClusterManagerListPagePo(page);
    const createEKSClusterPage = new ClusterManagerCreateEKSPagePo(page);
    let cloudCredId = '';
    let clusterId = '';

    try {
      // Navigate to EKS create page
      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.createCluster();
      await createEKSClusterPage.selectKubeProvider(0);
      await expect(createEKSClusterPage.loadingIndicator()).not.toBeAttached(SHORT_TIMEOUT_OPT);
      await expect(createEKSClusterPage.rke2PageTitle()).toContainText('Create Amazon EKS');
      await createEKSClusterPage.waitForPage('type=eks&rkeType=rke2');

      // Create cloud credential
      const cloudCredForm = createEKSClusterPage.cloudCredentialsForm();

      await cloudCredForm.saveButton().expectToBeDisabled();
      await cloudCredForm.nameNsDescription().name().set(credName);
      await cloudCredForm.accessKey().set(envMeta.awsAccessKey!);
      await cloudCredForm.secretKey().set(envMeta.awsSecretKey!);
      await cloudCredForm.saveButton().expectToBeEnabled();

      const credCreatePromise = page.waitForResponse(
        (resp) => resp.url().includes('/v3/cloudcredentials') && resp.request().method() === 'POST',
        SHORT_TIMEOUT_OPT,
      );
      const pageLoadPromise = page.waitForResponse(
        (resp) => resp.url().includes('/v1/management.cattle.io.users') && resp.request().method() === 'GET',
        { timeout: 30000 },
      );

      await cloudCredForm.saveCreateForm().cruResource().saveOrCreate().click();
      const credResp = await credCreatePromise;

      expect(credResp.status()).toBe(201);
      const credBody = await credResp.json();

      cloudCredId = credBody.id;

      await pageLoadPromise;
      await expect(createEKSClusterPage.loadingIndicator()).not.toBeAttached(SHORT_TIMEOUT_OPT);
      await createEKSClusterPage.waitForPage('type=eks&rkeType=rke2');

      // Set cluster name and description
      await createEKSClusterPage.getClusterName().set(clusterName);
      await createEKSClusterPage.getClusterDescription().set(`${clusterName}-description`);

      // Create cluster
      const clusterCreatePromise = page.waitForResponse(
        (resp) => resp.url().includes('v3/clusters') && resp.request().method() === 'POST',
        SHORT_TIMEOUT_OPT,
      );

      await createEKSClusterPage.create();
      const clusterResp = await clusterCreatePromise;

      expect(clusterResp.status()).toBe(201);
      const clusterBody = await clusterResp.json();

      expect(clusterBody).toHaveProperty('type', 'cluster');
      expect(clusterBody).toHaveProperty('name', clusterName);
      expect(clusterBody).toHaveProperty('description', `${clusterName}-description`);
      clusterId = clusterBody.id;

      await clusterList.waitForPage();
      await expect(clusterList.list().state(clusterName)).toContainText('Provisioning');

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
      if (cloudCredId) {
        await rancherApi.deleteRancherResource('v3', 'cloudcredentials', cloudCredId, false);
      }
    }
  });

  test('can create an Amazon EKS cluster with default values', async ({ login, page, rancherApi, envMeta }) => {
    test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

    await login();

    const clusterName = rancherApi.createE2EResourceName('ekscluster2');
    const credName = rancherApi.createE2EResourceName('ekscloudcredential2');
    const clusterList = new ClusterManagerListPagePo(page);
    const createEKSClusterPage = new ClusterManagerCreateEKSPagePo(page);
    let cloudCredId = '';
    let clusterId = '';

    try {
      // Create cloud credential first via API
      const credResp = await rancherApi.createRancherResource('v3', 'cloudcredentials', {
        type: 'provisioning.cattle.io/cloud-credential',
        metadata: { generateName: 'cc-', namespace: 'fleet-default' },
        _name: credName,
        annotations: { 'provisioning.cattle.io/driver': 'amazonec2' },
        amazonec2credentialConfig: {
          accessKey: envMeta.awsAccessKey,
          secretKey: envMeta.awsSecretKey,
        },
        _type: 'provisioning.cattle.io/cloud-credential',
        name: credName,
      });

      cloudCredId = credResp.body.id;

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.createCluster();
      await createEKSClusterPage.selectKubeProvider(0);
      await expect(createEKSClusterPage.loadingIndicator()).not.toBeAttached(SHORT_TIMEOUT_OPT);
      await expect(createEKSClusterPage.rke2PageTitle()).toContainText('Create Amazon EKS');
      await createEKSClusterPage.waitForPage('type=eks&rkeType=rke2');

      await createEKSClusterPage.credentialSelect().click();
      await createEKSClusterPage.dropdownOption(credName).click();

      // Verify defaults
      await createEKSClusterPage.getRegion().checkOptionSelected(eksSettings.eksRegion);

      const latestEKSversion = await createEKSClusterPage.getLatestEKSversion();

      await createEKSClusterPage.getVersion().checkOptionSelected(latestEKSversion);
      await createEKSClusterPage.getNodeGroup().shouldHaveValue(eksSettings.nodegroupName);
      await createEKSClusterPage.getNodeRole().checkOptionSelected(eksSettings.nodeRole);
      await createEKSClusterPage.getDesiredASGSize().shouldHaveValue(eksSettings.desiredSize);
      await createEKSClusterPage.getMinASGSize().shouldHaveValue(eksSettings.minSize);
      await createEKSClusterPage.getMaxASGSize().shouldHaveValue(eksSettings.maxSize);
      await createEKSClusterPage.getLaunchTemplate().checkOptionSelected(eksSettings.launchTemplate);
      await createEKSClusterPage.getInstanceType().checkContainsOptionSelected(eksSettings.instanceType);
      await createEKSClusterPage.getDiskSize().shouldHaveValue(eksSettings.diskSize);

      await createEKSClusterPage.serviceRoleRadioGroup().isChecked(0);

      await createEKSClusterPage.getPublicAccess().isChecked();
      await createEKSClusterPage.getPrivateAccess().isNotChecked();

      await createEKSClusterPage.vpcRadioGroup().isChecked(0);

      // Set cluster name and create
      await createEKSClusterPage.getClusterName().set(clusterName);
      await createEKSClusterPage.getClusterDescription().set(`${clusterName}-description`);

      const clusterCreatePromise = page.waitForResponse(
        (resp) => resp.url().includes('v3/clusters') && resp.request().method() === 'POST',
        SHORT_TIMEOUT_OPT,
      );

      await createEKSClusterPage.create();
      const clusterResp = await clusterCreatePromise;

      expect(clusterResp.status()).toBe(201);
      const clusterBody = await clusterResp.json();

      expect(clusterBody).toHaveProperty('type', 'cluster');
      expect(clusterBody).toHaveProperty('name', clusterName);
      expect(clusterBody).toHaveProperty('description', `${clusterName}-description`);
      expect(clusterBody.eksConfig.kubernetesVersion).toContain(latestEKSversion);
      expect(clusterBody.eksConfig.region).toBe(eksSettings.eksRegion);
      expect(clusterBody.eksConfig.privateAccess).toBe(eksSettings.privateAccess);
      expect(clusterBody.eksConfig.publicAccess).toBe(eksSettings.publicAccess);
      expect(clusterBody.eksConfig.nodeGroups[0].nodegroupName).toBe(eksSettings.nodegroupName);
      expect(clusterBody.eksConfig.nodeGroups[0].desiredSize).toBe(Number(eksSettings.desiredSize));
      expect(clusterBody.eksConfig.nodeGroups[0].minSize).toBe(Number(eksSettings.minSize));
      expect(clusterBody.eksConfig.nodeGroups[0].maxSize).toBe(Number(eksSettings.maxSize));
      expect(clusterBody.eksConfig.nodeGroups[0].instanceType).toBe(eksSettings.instanceType);
      expect(clusterBody.eksConfig.nodeGroups[0].diskSize).toBe(Number(eksSettings.diskSize));
      clusterId = clusterBody.id;

      await clusterList.waitForPage();
      await expect(clusterList.list().state(clusterName)).toContainText('Provisioning');

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
      if (cloudCredId) {
        await rancherApi.deleteRancherResource('v3', 'cloudcredentials', cloudCredId, false);
      }
    }
  });
});
