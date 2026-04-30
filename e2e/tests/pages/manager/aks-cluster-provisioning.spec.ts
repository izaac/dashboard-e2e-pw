import { test, expect } from '@/support/fixtures';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import ClusterManagerCreateAKSPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create-aks.po';
import * as aksDefaultSettings from '@/e2e/blueprints/cluster_management/aks-default-settings';
import { SHORT_TIMEOUT_OPT } from '@/support/timeouts';
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
        await aksCreatePage.getClusterDescription().set(`${clusterName}-description`);
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
        expect(clusterBody).toHaveProperty('description', `${clusterName}-description`);
        clusterId = clusterBody.id;

        await clusterList.waitForPage();
        await expect(clusterList.list().state(clusterName)).toContainText(/Waiting|Provisioning/);
      } finally {
        // Delete cluster FIRST so the AKS controller can use the credential during deprovision
        if (clusterId) {
          await rancherApi.deleteRancherResource('v3', 'clusters', clusterId, false);
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

        // Intercept AKS versions to determine latest version
        const aksVersionsPromise = page.waitForResponse(
          (resp) => resp.url().includes('/meta/aksVersions') && resp.request().method() === 'GET',
          { timeout: LONG },
        );

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

        // Resolve the latest AKS version from the intercepted response (semver comparison)
        const aksVersionsResp = await aksVersionsPromise;
        const aksVersionsBody = await aksVersionsResp.json();
        let latestAKSversion: string;

        if (Array.isArray(aksVersionsBody) && aksVersionsBody.length > 0) {
          latestAKSversion = aksVersionsBody.reduce((latest: string, v: string) => {
            const lParts = latest.split('.').map(Number);
            const vParts = v.split('.').map(Number);

            for (let i = 0; i < 3; i++) {
              const diff = (vParts[i] || 0) - (lParts[i] || 0);

              if (diff !== 0) {
                return diff > 0 ? v : latest;
              }
            }

            return latest;
          });
        } else {
          latestAKSversion =
            (await aksCreatePage.kubernetesVersionSelect().selectedOption().textContent())?.trim() ?? '';
        }

        // --- Form default assertions ---

        // Region & Kubernetes version
        await expect(aksCreatePage.regionSelect().selectedOption()).toContainText('East US');
        await expect(aksCreatePage.kubernetesVersionSelect().selectedOption()).toContainText(latestAKSversion);

        // Node pool defaults
        await expect(aksCreatePage.getNodeGroup().input()).toHaveValue(aksDefaultSettings.defaultNodePool.name);
        await expect(aksCreatePage.getVMsize().selectedOption()).toContainText(
          aksDefaultSettings.defaultNodePool.vmSize,
        );
        await expect(aksCreatePage.getAvailabilityZones().selectedOption().first()).toContainText(/zone/i);
        await expect(aksCreatePage.getOSdiskType().selectedOption()).toContainText(
          aksDefaultSettings.defaultNodePool.osDiskType,
        );
        await expect(aksCreatePage.getOSdiskSize().input()).toHaveValue(
          aksDefaultSettings.defaultNodePool.osDiskSizeGB,
        );
        await expect(aksCreatePage.getNodeCount().input()).toHaveValue(aksDefaultSettings.defaultNodePool.count);
        await expect(aksCreatePage.getMaxPods().input()).toHaveValue(aksDefaultSettings.defaultNodePool.maxPods);
        await expect(aksCreatePage.getMaxSurge().input()).toHaveValue(aksDefaultSettings.defaultNodePool.maxSurge);

        // Auto scaling unchecked
        await expect(aksCreatePage.getAutoScaling().checkboxCustom()).toHaveAttribute('aria-checked', 'false');

        // Linux admin username
        await expect(aksCreatePage.getLinuxAdmin().input()).toHaveValue(
          aksDefaultSettings.defaultAksConfig.linuxAdminUsername,
        );

        // Resource group placeholders
        await expect(aksCreatePage.clusterResourceGroup()).toHaveAttribute('placeholder', /aks-resource-group/);
        await expect(aksCreatePage.getNodeResourceGroup().input()).toHaveAttribute(
          'placeholder',
          /aks-node-resource-group/,
        );

        // Log analytics fields disabled
        await expect(aksCreatePage.getLogResourceGroup().input()).toBeDisabled();
        await expect(aksCreatePage.getLogWorkspaceName().input()).toBeDisabled();

        // Container monitoring unchecked
        await expect(aksCreatePage.getContainerMonitoring().checkboxCustom()).toHaveAttribute('aria-checked', 'false');

        // SSH key placeholder
        await expect(aksCreatePage.getSSHkey().input()).toHaveAttribute('placeholder', /SSH public key/i);

        // Load balancer SKU disabled with value "Standard"
        await expect(aksCreatePage.getLoadBalancerSKU().self()).toHaveClass(/disabled/);
        await expect(aksCreatePage.getLoadBalancerSKU().selectedOption()).toContainText(
          aksDefaultSettings.defaultAksConfig.loadBalancerSku,
        );

        // DNS prefix placeholder
        await expect(aksCreatePage.dnsPrefixInput()).toHaveAttribute('placeholder', /aks-dns/);

        // Networking defaults
        await expect(aksCreatePage.getOutboundType().selectedOption()).toContainText(/loadBalancer/i);
        await expect(aksCreatePage.getNetworkPlugin().selectedOption()).toContainText(/kubenet/i);
        await expect(aksCreatePage.getNetworkPolicy().selectedOption()).toContainText('None');
        await expect(aksCreatePage.getVirtualNetwork().selectedOption()).toContainText('None');

        // CIDR defaults
        await expect(aksCreatePage.getKubernetesSAR().input()).toHaveValue(
          aksDefaultSettings.defaultAksConfig.serviceCidr,
        );
        await expect(aksCreatePage.getKubernetesDNS().input()).toHaveValue(
          aksDefaultSettings.defaultAksConfig.dnsServiceIp,
        );
        await expect(aksCreatePage.getDockerBridge().input()).toHaveValue(
          aksDefaultSettings.defaultAksConfig.dockerBridgeCidr,
        );

        // Pool mode: System radio checked, User unchecked
        await expect(aksCreatePage.getPoolModeRadio().radioSpan(0)).toHaveAttribute('aria-checked', 'true');
        await expect(aksCreatePage.getPoolModeRadio().radioSpan(1)).toHaveAttribute('aria-checked', 'false');

        // Auth mode: Service Principal checked, Managed Identity unchecked
        await expect(aksCreatePage.getAuthModeRadio().radioSpan(0)).toHaveAttribute('aria-checked', 'true');
        await expect(aksCreatePage.getAuthModeRadio().radioSpan(1)).toHaveAttribute('aria-checked', 'false');

        // Remaining checkboxes
        await expect.poll(() => aksCreatePage.getProjNetworkIsolation().isDisabled()).toBe(true);
        await expect(aksCreatePage.getProjNetworkIsolation().checkboxCustom()).toHaveAttribute('aria-checked', 'false');
        await expect(aksCreatePage.getHTTProuting().checkboxCustom()).toHaveAttribute('aria-checked', 'false');
        await expect(aksCreatePage.getEnablePrivateCluster().checkboxCustom()).toHaveAttribute('aria-checked', 'false');
        await expect(aksCreatePage.getAuthIPranges().checkboxCustom()).toHaveAttribute('aria-checked', 'false');

        // Fill mandatory fields and create
        await aksCreatePage.getClusterName().set(clusterName);
        await aksCreatePage.getClusterDescription().set(`${clusterName}-description`);
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

        // --- Response body assertions ---

        expect(clusterBody).toHaveProperty('type', 'cluster');
        expect(clusterBody).toHaveProperty('name', clusterName);
        expect(clusterBody).toHaveProperty('description', `${clusterName}-description`);

        // aksConfig top-level properties
        expect(clusterBody.aksConfig).toHaveProperty('kubernetesVersion', latestAKSversion);
        expect(clusterBody.aksConfig).toHaveProperty('resourceLocation', aksDefaultSettings.DEFAULT_REGION);
        expect(clusterBody.aksConfig).toHaveProperty(
          'linuxAdminUsername',
          aksDefaultSettings.defaultAksConfig.linuxAdminUsername,
        );
        expect(clusterBody.aksConfig).toHaveProperty('resourceGroup', aksSettings.resourceGroup);
        expect(clusterBody.aksConfig).toHaveProperty(
          'loadBalancerSku',
          aksDefaultSettings.defaultAksConfig.loadBalancerSku,
        );
        expect(clusterBody.aksConfig).toHaveProperty('dnsPrefix', aksSettings.dnsPrefix);
        expect(clusterBody.aksConfig.outboundType.toLowerCase()).toBe('loadbalancer');
        expect(clusterBody.aksConfig.networkPlugin.toLowerCase()).toBe('kubenet');
        expect(clusterBody.aksConfig).not.toHaveProperty('networkPolicy');
        expect(clusterBody.aksConfig).not.toHaveProperty('virtualNetwork');
        expect(clusterBody.aksConfig).toHaveProperty('serviceCidr', aksDefaultSettings.defaultAksConfig.serviceCidr);
        expect(clusterBody.aksConfig).toHaveProperty('dnsServiceIp', aksDefaultSettings.defaultAksConfig.dnsServiceIp);
        expect(clusterBody.aksConfig).toHaveProperty(
          'dockerBridgeCidr',
          aksDefaultSettings.defaultAksConfig.dockerBridgeCidr,
        );
        expect(clusterBody.aksConfig).not.toHaveProperty('httpApplicationRouting');
        expect(clusterBody.aksConfig).not.toHaveProperty('managedIdentity');
        expect(clusterBody.aksConfig).not.toHaveProperty('authorizedIpRanges');
        expect(clusterBody.aksConfig).toHaveProperty(
          'privateCluster',
          aksDefaultSettings.defaultAksConfig.privateCluster,
        );

        // aksConfig.nodePools[0] properties
        const nodePool = clusterBody.aksConfig.nodePools[0];

        expect(nodePool).toHaveProperty('name', aksDefaultSettings.defaultNodePool.name);
        expect(nodePool).toHaveProperty('enableAutoScaling', aksDefaultSettings.defaultNodePool.enableAutoScaling);
        expect(nodePool).toHaveProperty('maxSurge', aksDefaultSettings.defaultNodePool.maxSurge);
        expect(nodePool).toHaveProperty('maxPods', 110);
        expect(nodePool).toHaveProperty('mode', aksDefaultSettings.defaultNodePool.mode);
        expect(nodePool).toHaveProperty('vmSize', aksDefaultSettings.defaultNodePool.vmSize);
        expect(nodePool).toHaveProperty('osDiskType', aksDefaultSettings.defaultNodePool.osDiskType);
        expect(nodePool).toHaveProperty('osDiskSizeGB', 128);
        expect(nodePool.count).toBe(1);

        // Availability zones should contain zone numbers 1, 2, 3
        const zoneNumbers = aksDefaultSettings.defaultNodePool.availabilityZones.match(/\d+/g);

        expect(nodePool.availabilityZones).toEqual(expect.arrayContaining(zoneNumbers!));

        clusterId = clusterBody.id;

        await clusterList.waitForPage();
        await expect(clusterList.list().state(clusterName)).toContainText(/Waiting|Provisioning/);
      } finally {
        // Delete cluster FIRST so the AKS controller can use the credential during deprovision
        if (clusterId) {
          await rancherApi.deleteRancherResource('v3', 'clusters', clusterId, false);
        }
        if (cloudCredId) {
          await rancherApi.deleteRancherResource('v3', 'cloudcredentials', cloudCredId, false);
        }
      }
    });
  },
);
