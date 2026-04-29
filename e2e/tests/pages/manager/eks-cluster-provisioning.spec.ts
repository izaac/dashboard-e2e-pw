import { test, expect } from '@/support/fixtures';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import ClusterManagerCreateEKSPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create-eks.po';
import * as eksDefaultSettings from '@/e2e/blueprints/cluster_management/eks-default-settings';
import { SHORT_TIMEOUT_OPT } from '@/support/utils/timeouts';
import { LONG } from '@/support/timeouts';

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
    // Clean stale e2e EKS clusters — delete v3 cluster objects first so the
    // controller stops referencing their cloud credentials
    const clusters = await rancherApi.getRancherResource('v3', 'clusters', undefined, 0);

    if (clusters.body?.data) {
      for (const c of clusters.body.data) {
        if (c.name?.startsWith('e2e-test-') && c.eksConfig) {
          await rancherApi.deleteRancherResource('v3', 'clusters', c.id, false);
        }
      }
    }

    // Also clean provisioning objects that may linger after v3 deletion
    const provClusters = await rancherApi.getRancherResource('v1', 'provisioning.cattle.io.clusters', undefined, 0);

    if (provClusters.body?.data) {
      for (const c of provClusters.body.data) {
        if (c.metadata?.name?.startsWith('e2e-test-') && c.spec?.eksConfig) {
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

    // Clean stale e2e Amazon cloud credentials (safe now that clusters are gone)
    const creds = await rancherApi.getRancherResource('v3', 'cloudcredentials', undefined, 0);

    if (creds.body?.data) {
      for (const item of creds.body.data) {
        if (item.amazonec2credentialConfig && item.name?.startsWith('e2e-test-')) {
          await rancherApi.deleteRancherResource('v3', 'cloudcredentials', item.id, false);
        }
      }
    }

    // Let Rancher store settle after credential cleanup
    await new Promise((r) => setTimeout(r, 5_000));
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

      // Create cloud credential inline
      const cloudCredForm = createEKSClusterPage.cloudCredentialsForm();

      await expect(cloudCredForm.saveButton().self()).toBeDisabled();
      await cloudCredForm.nameNsDescription().name().set(credName);
      await cloudCredForm.accessKey().set(envMeta.awsAccessKey!);
      await cloudCredForm.secretKey().set(envMeta.awsSecretKey!);
      await expect(cloudCredForm.saveButton().self()).toBeEnabled();

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
      await expect(clusterList.list().state(clusterName)).toContainText(/Waiting|Provisioning/);
    } finally {
      // Delete cluster FIRST so the EKS controller can use the credential during deprovision
      if (clusterId) {
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
      // Navigate to EKS create page
      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.createCluster();
      await createEKSClusterPage.selectKubeProvider(0);
      await expect(createEKSClusterPage.loadingIndicator()).not.toBeAttached(SHORT_TIMEOUT_OPT);
      await expect(createEKSClusterPage.rke2PageTitle()).toContainText('Create Amazon EKS');
      await createEKSClusterPage.waitForPage('type=eks&rkeType=rke2');

      // Create cloud credential inline — SelectCredential only lists
      // credentials that existed before page load
      const cloudCredForm = createEKSClusterPage.cloudCredentialsForm();

      await cloudCredForm.nameNsDescription().name().set(credName);
      await cloudCredForm.accessKey().set(envMeta.awsAccessKey!);
      await cloudCredForm.secretKey().set(envMeta.awsSecretKey!);

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
      await expect(createEKSClusterPage.loadingIndicator()).not.toBeAttached(SHORT_TIMEOUT_OPT);
      await createEKSClusterPage.waitForPage('type=eks&rkeType=rke2');

      // Verify defaults
      await expect(createEKSClusterPage.getRegion().selectedOption()).toHaveText(eksSettings.eksRegion, {
        useInnerText: true,
      });

      // Verify defaults — version dropdown defaults to latest EKS version.
      // Upstream reads from a static data file (eks-versions.js), not the UI.
      // We read the pre-selected value and verify it's a valid version number.
      const latestEKSversion = await createEKSClusterPage.getVersion().selectedOption().innerText();

      expect(parseFloat(latestEKSversion.trim())).toBeGreaterThan(0);
      await expect(createEKSClusterPage.getNodeGroup().self()).toHaveValue(eksSettings.nodegroupName);
      await expect(createEKSClusterPage.getNodeRole().selectedOption()).toHaveText(eksSettings.nodeRole, {
        useInnerText: true,
      });
      await expect(createEKSClusterPage.getDesiredASGSize().self()).toHaveValue(eksSettings.desiredSize);
      await expect(createEKSClusterPage.getMinASGSize().self()).toHaveValue(eksSettings.minSize);
      await expect(createEKSClusterPage.getMaxASGSize().self()).toHaveValue(eksSettings.maxSize);
      await expect(createEKSClusterPage.getLaunchTemplate().selectedOption()).toHaveText(eksSettings.launchTemplate, {
        useInnerText: true,
      });
      await expect(createEKSClusterPage.getInstanceType().selectedOption()).toContainText(eksSettings.instanceType);
      await expect(createEKSClusterPage.getDiskSize().self()).toHaveValue(eksSettings.diskSize);

      await expect(createEKSClusterPage.serviceRoleRadioGroup().radioSpan(0)).toHaveAttribute('aria-checked', 'true');

      await expect(createEKSClusterPage.getPublicAccess().checkboxCustom()).toHaveAttribute('aria-checked', 'true');
      await expect(createEKSClusterPage.getPrivateAccess().checkboxCustom()).toHaveAttribute('aria-checked', 'false');

      await expect(createEKSClusterPage.vpcRadioGroup().radioSpan(0)).toHaveAttribute('aria-checked', 'true');

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
      expect(clusterBody.eksConfig.kubernetesVersion).toContain(latestEKSversion.trim());
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
      await expect(clusterList.list().state(clusterName)).toContainText(/Waiting|Provisioning/);
    } finally {
      // Delete cluster FIRST so the EKS controller can use the credential during deprovision
      if (clusterId) {
        await rancherApi.deleteRancherResource('v3', 'clusters', clusterId, false);
      }
      if (cloudCredId) {
        await rancherApi.deleteRancherResource('v3', 'cloudcredentials', cloudCredId, false);
      }
    }
  });
});
