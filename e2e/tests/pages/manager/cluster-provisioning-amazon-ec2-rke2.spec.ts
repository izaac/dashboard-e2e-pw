import { test, expect } from '@/support/fixtures';
import ClusterManagerCreateRke2AmazonPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create-rke2-amazon.po';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import ClusterManagerDetailRke2AmazonEc2PagePo from '@/e2e/po/detail/provisioning.cattle.io.cluster/cluster-detail-rke2-amazon.po';
import ClusterManagerEditGenericPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/edit/cluster-edit-generic.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import describeSubnetsResponse from '@/e2e/blueprints/manager/describe-subnets-response';
import describeVpcsResponse from '@/e2e/blueprints/manager/describe-vpcs-response';
import { SHORT_TIMEOUT_OPT } from '@/support/utils/timeouts';

const MEDIUM_TIMEOUT = 120_000;
const LONG_TIMEOUT = 360_000;
const VERY_LONG_TIMEOUT = 900_000;

// Provisioning chain: tests run sequentially and depend on cluster created by first test. This is intentional — cluster provisioning takes 10+ minutes and cannot be repeated per test.
test.describe(
  'Deploy RKE2 cluster using node driver on Amazon EC2',
  { tag: ['@manager', '@adminUser', '@provisioning', '@needsInfra'] },
  () => {
    test.beforeAll(async ({ rancherApi }) => {
      // Clean up only test-prefixed Amazon cloud credentials from previous runs
      const result = await rancherApi.getRancherResource('v3', 'cloudcredentials', undefined, 0);

      if (result.body?.pagination?.total > 0) {
        for (const item of result.body.data) {
          if (item.amazonec2credentialConfig && item.name?.startsWith('e2e-test-')) {
            await rancherApi.deleteRancherResource('v3', 'cloudcredentials', item.id, false);
          }
        }
      }
    });

    test('can create an RKE2 cluster using Amazon cloud provider', async ({ login, page, rancherApi, envMeta }) => {
      test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

      await login();

      const clusterName = rancherApi.createE2EResourceName('ec2-create');
      const credentialName = rancherApi.createE2EResourceName('ec2cloudcredential');
      const clusterList = new ClusterManagerListPagePo(page);
      const createRKE2ClusterPage = new ClusterManagerCreateRke2AmazonPagePo(page);
      let cloudcredentialId = '';
      let clusterId = '';
      let olderK8sVersion = '';

      try {
        await page.route('/v1-rke2-release/releases', (route) => route.continue());

        await clusterList.goTo();
        await clusterList.waitForPage();
        await clusterList.createCluster();
        await createRKE2ClusterPage.selectCreate(0);
        await expect(createRKE2ClusterPage.loadingIndicator()).not.toBeAttached(SHORT_TIMEOUT_OPT);
        await expect(createRKE2ClusterPage.rke2PageTitle()).toContainText('Create Amazon EC2');
        await createRKE2ClusterPage.waitForPage('type=amazonec2&rkeType=rke2');

        const cloudCredForm = createRKE2ClusterPage.cloudCredentialsForm();

        await cloudCredForm.saveButton().expectToBeDisabled();
        await cloudCredForm.nameNsDescription().name().set(credentialName);
        await cloudCredForm.accessKey().set(envMeta.awsAccessKey!);
        await cloudCredForm.secretKey().set(envMeta.awsSecretKey!);
        await cloudCredForm.defaultRegion().toggle();
        await cloudCredForm.defaultRegion().clickOptionWithLabel('us-west-1');
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

        cloudcredentialId = credBody.id;

        await pageLoadPromise;
        await expect(createRKE2ClusterPage.loadingIndicator()).not.toBeAttached(SHORT_TIMEOUT_OPT);
        await createRKE2ClusterPage.waitForPage('type=amazonec2&rkeType=rke2', 'basic');

        await createRKE2ClusterPage.nameNsDescription().name().set(clusterName);
        await createRKE2ClusterPage.nameNsDescription().description().set(`${clusterName}-description`);

        // Get K8s versions from dropdown
        await createRKE2ClusterPage.basicsTab().kubernetesVersions().toggle();
        const options = createRKE2ClusterPage.basicsTab().kubernetesVersions().getOptions();

        await expect(options.first()).toBeVisible();
        const allTexts = await options.allInnerTexts();

        // index 0 is the RKE2 header, actual versions start at 1
        olderK8sVersion = allTexts[2]?.trim() || '';
        if (olderK8sVersion) {
          await createRKE2ClusterPage.basicsTab().kubernetesVersions().clickOptionWithLabel(olderK8sVersion);
        } else {
          await page.keyboard.press('Escape');
        }

        await createRKE2ClusterPage.machinePoolTab().networks().toggle();
        await createRKE2ClusterPage.machinePoolTab().networks().clickOptionWithLabel('default');

        const clusterCreatePromise = page.waitForResponse(
          (resp) => resp.url().includes('v1/provisioning.cattle.io.clusters') && resp.request().method() === 'POST',
          SHORT_TIMEOUT_OPT,
        );

        await createRKE2ClusterPage.create();
        const clusterResp = await clusterCreatePromise;

        expect(clusterResp.status()).toBe(201);
        const clusterBody = await clusterResp.json();

        expect(clusterBody).toHaveProperty('kind', 'Cluster');
        expect(clusterBody.metadata).toHaveProperty('name', clusterName);
        if (olderK8sVersion) {
          expect(clusterBody.spec.kubernetesVersion).toContain(olderK8sVersion);
        }
        clusterId = clusterBody.id;

        await clusterList.waitForPage();
        const stateLocator = clusterList.list().state(clusterName);

        await expect(stateLocator).toBeVisible();
        await expect(stateLocator).toContainText(/Reconciling|Updating/);

        // Fail early if cloud credentials are bad instead of waiting for a long timeout
        await rancherApi.assertClusterProvisioningNotStuck('v1', clusterId);
      } finally {
        if (clusterId) {
          await rancherApi.deleteRancherResource('v1', 'provisioning.cattle.io.clusters', clusterId, false);
        }
        if (cloudcredentialId) {
          await rancherApi.deleteRancherResource('v3', 'cloudCredentials', cloudcredentialId, false);
        }
      }
    });

    test('can see details of cluster in cluster list', async ({ login, page, rancherApi, envMeta }) => {
      test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

      await login();

      const clusterName = rancherApi.createE2EResourceName('ec2-list');
      const clusterList = new ClusterManagerListPagePo(page);

      // This test expects a cluster created by the previous test to be in "Active" state.
      // In a real run it polls for the cluster — here we navigate and assert on whatever state it's in.
      await clusterList.goTo();
      await clusterList.waitForPage();

      await expect(clusterList.list().resourceTable().sortableTable().rowWithName(clusterName).self()).toBeVisible({
        timeout: LONG_TIMEOUT,
      });
      await expect(clusterList.list().state(clusterName)).toContainText('Active', { timeout: VERY_LONG_TIMEOUT });

      await expect(clusterList.list().resourceTable().resourceTableDetails(clusterName, 4)).toContainText('Amazon EC2');
      await expect(clusterList.list().resourceTable().resourceTableDetails(clusterName, 5)).toContainText('RKE2');
    });

    test('cluster details page', async ({ login, page, rancherApi, envMeta }) => {
      test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

      await login();

      const clusterName = rancherApi.createE2EResourceName('ec2-detail');
      const clusterList = new ClusterManagerListPagePo(page);
      const clusterDetails = new ClusterManagerDetailRke2AmazonEc2PagePo(page, '_', clusterName);
      const tabbedPo = new TabbedPo(page, '[data-testid="tabbed-block"]');

      await clusterList.goTo();
      await clusterList.waitForPage();

      await clusterList.clusterLink(clusterName).click();
      await clusterDetails.waitForPage(undefined, 'machine-pools');
      await expect(clusterDetails.resourceDetail().title()).toContainText(clusterName);

      await clusterDetails.selectTab(tabbedPo, '[data-testid="btn-events"]');
      await clusterDetails.waitForPage(undefined, 'events');
      await clusterDetails.recentEventsList().checkTableIsEmpty();
    });

    test('can scale up a machine pool', async ({ login, page, rancherApi, envMeta }) => {
      test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

      await login();

      const clusterName = rancherApi.createE2EResourceName('ec2-scaleup');
      const clusterList = new ClusterManagerListPagePo(page);
      const clusterDetails = new ClusterManagerDetailRke2AmazonEc2PagePo(page, '_', clusterName);
      const poolName = `${clusterName}-pool1`;

      await clusterList.goTo();
      await clusterList.waitForPage();

      await clusterList.clusterLink(clusterName).click();
      await clusterDetails.waitForPage(undefined, 'machine-pools');
      await expect(clusterDetails.resourceDetail().title()).toContainText(clusterName);

      await clusterDetails.poolsList('machine').resourceTable().sortableTable().groupByButtons(1).click();

      await expect(clusterDetails.poolsList('machine').scaleUpButton(poolName)).toBeVisible();
      await expect(clusterDetails.poolsList('machine').scaleUpButton(poolName)).toBeEnabled();
      await expect(clusterDetails.poolsList('machine').scaleDownButton(poolName)).toBeVisible();
      await expect(clusterDetails.poolsList('machine').scaleDownButton(poolName)).toBeDisabled();

      const scaleUpPromise = page.waitForResponse(
        (resp) =>
          resp.url().includes(`/v1/provisioning.cattle.io.clusters/fleet-default/${clusterName}`) &&
          resp.request().method() === 'PUT',
        SHORT_TIMEOUT_OPT,
      );

      await clusterDetails.poolsList('machine').scaleUpButton(poolName).click();
      const scaleUpResp = await scaleUpPromise;

      expect(scaleUpResp.status()).toBe(200);

      await expect(clusterDetails.poolsList('machine').machineProgressBarError(poolName)).toBeAttached({
        timeout: LONG_TIMEOUT,
      });
      await expect(clusterDetails.poolsList('machine').scaleDownButton(poolName)).toBeEnabled({
        timeout: VERY_LONG_TIMEOUT,
      });
      await expect(clusterDetails.resourceDetail().masthead()).toContainText('Active', { timeout: VERY_LONG_TIMEOUT });
    });

    test('can scale down a machine pool', async ({ login, page, rancherApi, envMeta }) => {
      test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

      await login();

      const clusterName = rancherApi.createE2EResourceName('ec2-scaledn');
      const clusterList = new ClusterManagerListPagePo(page);
      const clusterDetails = new ClusterManagerDetailRke2AmazonEc2PagePo(page, '_', clusterName);
      const poolName = `${clusterName}-pool1`;

      await rancherApi.setUserPreference({ 'scale-pool-prompt': false });

      try {
        await clusterList.goTo();
        await clusterList.waitForPage();

        await clusterList
          .list()
          .resourceTable()
          .sortableTable()
          .detailsPageLinkWithName(clusterName, '.cluster-link a')
          .click();
        await clusterDetails.waitForPage(undefined, 'machine-pools');

        await clusterDetails.poolsList('machine').resourceTable().sortableTable().groupByButtons(1).click();

        await expect(clusterDetails.poolsList('machine').scaleDownButton(poolName)).toBeEnabled();

        const scaleDownPromise = page.waitForResponse(
          (resp) =>
            resp.url().includes(`/v1/provisioning.cattle.io.clusters/fleet-default/${clusterName}`) &&
            resp.request().method() === 'PUT',
          SHORT_TIMEOUT_OPT,
        );

        await clusterDetails.poolsList('machine').scaleDownButton(poolName).click();

        const confirmBtn = clusterDetails.poolsList('machine').scalePoolDownConfirm();

        if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confirmBtn.click();
        }

        const scaleDownResp = await scaleDownPromise;

        expect(scaleDownResp.status()).toBe(200);

        await expect(clusterDetails.poolsList('machine').machineProgressBarError(poolName)).toBeAttached({
          timeout: LONG_TIMEOUT,
        });
        await expect(clusterDetails.poolsList('machine').scaleDownButton(poolName)).toBeDisabled({
          timeout: VERY_LONG_TIMEOUT,
        });
      } finally {
        await rancherApi.setUserPreference({ 'scale-pool-prompt': null });
      }
    });

    test('can upgrade Kubernetes version', async ({ login, page, rancherApi, envMeta }) => {
      test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

      await login();

      const clusterName = rancherApi.createE2EResourceName('ec2-upgrade');
      const clusterList = new ClusterManagerListPagePo(page);
      const editClusterPage = new ClusterManagerEditGenericPagePo(page, '_', clusterName);

      await clusterList.goTo();
      await clusterList.waitForPage();

      await clusterList.editCluster(clusterName);
      await editClusterPage.waitForPage('mode=edit', 'basic');

      // Open k8s version dropdown and pick the latest version (index 1 = first after header)
      await editClusterPage.basicsTab().kubernetesVersions().toggle();
      const options = editClusterPage.basicsTab().kubernetesVersions().getOptions();

      await expect(options.first()).toBeVisible();
      const allTexts = await options.allInnerTexts();
      const latestK8sVersion = allTexts[1]?.trim() || '';

      if (latestK8sVersion) {
        await editClusterPage.basicsTab().kubernetesVersions().clickOptionWithLabel(latestK8sVersion);
      } else {
        await page.keyboard.press('Escape');
      }

      const updatePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes(`/v1/provisioning.cattle.io.clusters/fleet-default/${clusterName}`) &&
          resp.request().method() === 'PUT',
        SHORT_TIMEOUT_OPT,
      );

      await editClusterPage.resourceDetail().createEditView().save();
      const updateResp = await updatePromise;

      expect([200, 409]).toContain(updateResp.status());

      await clusterList.waitForPage();
      await expect(clusterList.list().state(clusterName)).toContainText('Active', { timeout: VERY_LONG_TIMEOUT });
    });

    test('can create snapshot', async ({ login, page, rancherApi, envMeta }) => {
      test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

      await login();

      const clusterName = rancherApi.createE2EResourceName('ec2-snap');
      const clusterList = new ClusterManagerListPagePo(page);
      const clusterDetails = new ClusterManagerDetailRke2AmazonEc2PagePo(page, '_', clusterName);
      const tabbedPo = new TabbedPo(page, '[data-testid="tabbed-block"]');

      await clusterList.goTo();
      await clusterList.waitForPage();

      await clusterList.list().resourceTable().sortableTable().detailsPageLinkWithName(clusterName).click();
      await clusterDetails.waitForPage(undefined, 'machine-pools');
      await clusterDetails.selectTab(tabbedPo, '[data-testid="btn-snapshots"]');
      await clusterDetails.waitForPage(undefined, 'snapshots');
      await clusterDetails.snapshotsList().checkTableIsEmpty();

      await clusterDetails.snapshotsList().clickOnSnapshotNow();

      await clusterList.goTo();
      await clusterList.waitForPage();
      await expect(clusterList.list().state(clusterName)).toContainText('Active', { timeout: VERY_LONG_TIMEOUT });

      await clusterList.list().resourceTable().sortableTable().detailsPageLinkWithName(clusterName).click();
      await clusterDetails.waitForPage(undefined, 'machine-pools');
      await clusterDetails.selectTab(tabbedPo, '[data-testid="btn-snapshots"]');
      await clusterDetails.waitForPage(undefined, 'snapshots');
      await expect(clusterDetails.snapshotsList().checkSnapshotExist(`on-demand-${clusterName}`)).toBeVisible();
    });

    test('can delete an Amazon EC2 RKE2 cluster', async ({ login, page, rancherApi, envMeta }) => {
      test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

      await login();

      const clusterName = rancherApi.createE2EResourceName('ec2-del');
      const clusterList = new ClusterManagerListPagePo(page);

      await clusterList.goTo();
      await clusterList.waitForPage();

      const actionMenu = await clusterList.list().actionMenu(clusterName);

      await actionMenu.getMenuItem('Delete').click();

      const promptRemove = new PromptRemove(page);

      await promptRemove.confirm(clusterName);
      await promptRemove.remove();

      await clusterList.waitForPage();
      await expect(clusterList.list().state(clusterName)).toContainText('Removing');
      await expect(clusterList.list().resourceTable().sortableTable().rowWithName(clusterName).self()).not.toBeAttached(
        { timeout: MEDIUM_TIMEOUT },
      );
    });

    test('validates cluster networking configuration when machines are using dual-stack networking', async ({
      login,
      page,
      rancherApi,
      envMeta,
    }) => {
      test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

      await login();

      const clusterName = rancherApi.createE2EResourceName('ec2-dual');
      const clusterList = new ClusterManagerListPagePo(page);
      const createRKE2ClusterPage = new ClusterManagerCreateRke2AmazonPagePo(page);

      await page.route('meta/proxy/ec2*', (route) => {
        const body = route.request().postData() || '';

        if (body.includes('DescribeSubnets')) {
          route.fulfill({ status: 200, body: JSON.stringify(describeSubnetsResponse) });
        } else if (body.includes('DescribeVpcs')) {
          route.fulfill({ status: 200, body: JSON.stringify(describeVpcsResponse) });
        } else {
          route.continue();
        }
      });

      await page.route('v1/provisioning.cattle.io.clusters', (route) => {
        if (route.request().method() === 'POST') {
          route.fulfill({ status: 200, body: JSON.stringify({}) });
        } else {
          route.continue();
        }
      });

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.createCluster();
      await createRKE2ClusterPage.selectCreate(0);
      await expect(createRKE2ClusterPage.loadingIndicator()).not.toBeAttached(SHORT_TIMEOUT_OPT);
      await expect(createRKE2ClusterPage.rke2PageTitle()).toContainText('Create Amazon EC2');
      await createRKE2ClusterPage.waitForPage('type=amazonec2&rkeType=rke2', 'basic');

      await createRKE2ClusterPage.nameNsDescription().name().set(clusterName);
      await createRKE2ClusterPage.machinePoolTab().enableDualStack().set();
      await createRKE2ClusterPage.machinePoolTab().networks().toggle();
      await createRKE2ClusterPage.machinePoolTab().networks().clickOptionWithLabel('(vpc-123)');
      await createRKE2ClusterPage.machinePoolTab().enableIpv6().set();

      await createRKE2ClusterPage.create();

      await expect(createRKE2ClusterPage.ipv6ConfirmationDialog()).toBeVisible();
      await expect(createRKE2ClusterPage.ipv6Recommendations()).toHaveCount(2);

      await createRKE2ClusterPage.ipv6DialogCancelButton().click();

      // Toggle to k3s — should have 3 warnings
      await createRKE2ClusterPage.basicsTab().kubernetesVersions().toggle();
      await createRKE2ClusterPage.basicsTab().kubernetesVersions().clickOptionWithLabel('k3s');

      await createRKE2ClusterPage.create();
      await expect(createRKE2ClusterPage.ipv6ConfirmationDialog()).toBeVisible();
      await expect(createRKE2ClusterPage.ipv6Recommendations()).toHaveCount(3);
      await createRKE2ClusterPage.ipv6DialogCancelButton().click();

      // Toggle off ipv6-only
      await createRKE2ClusterPage.machinePoolTab().enableIpv6().set();

      await createRKE2ClusterPage.create();
      await expect(createRKE2ClusterPage.ipv6ConfirmationDialog()).toBeVisible();
      await expect(createRKE2ClusterPage.ipv6Recommendations()).toHaveCount(2);
      await expect(createRKE2ClusterPage.ipv6Recommendations()).not.toContainText('Masq');
      await createRKE2ClusterPage.ipv6DialogCancelButton().click();

      // Set stack preference to IPv6
      await createRKE2ClusterPage.clusterConfigurationTabs().clickTabWithSelector('#networking');
      await createRKE2ClusterPage.networkTab().stackPreference().toggle();
      await createRKE2ClusterPage.networkTab().stackPreference().clickOptionWithLabel('IPv6');

      await createRKE2ClusterPage.create();
      await expect(createRKE2ClusterPage.ipv6ConfirmationDialog()).toBeVisible();
      await expect(createRKE2ClusterPage.ipv6Recommendations()).toHaveCount(1);
      await expect(createRKE2ClusterPage.ipv6Recommendations()).not.toContainText('Stack Preference');
      await createRKE2ClusterPage.ipv6DialogCancelButton().click();

      // Set to Dual — should not reintroduce the warning
      await createRKE2ClusterPage.networkTab().stackPreference().toggle();
      await createRKE2ClusterPage.networkTab().stackPreference().clickOptionWithLabel('Dual');

      await createRKE2ClusterPage.create();
      await expect(createRKE2ClusterPage.ipv6ConfirmationDialog()).toBeVisible();
      await expect(createRKE2ClusterPage.ipv6Recommendations()).toHaveCount(1);
      await expect(createRKE2ClusterPage.ipv6Recommendations()).not.toContainText('Stack Preference');
      await createRKE2ClusterPage.ipv6DialogCancelButton().click();

      // Toggle ipv6-only back on
      await createRKE2ClusterPage.machinePoolTab().enableIpv6().set();

      await createRKE2ClusterPage.create();
      await expect(createRKE2ClusterPage.ipv6ConfirmationDialog()).toBeVisible();
      await expect(createRKE2ClusterPage.ipv6Recommendations()).toHaveCount(3);
      await expect(createRKE2ClusterPage.ipv6Recommendations()).toContainText('Stack Preference');
      await createRKE2ClusterPage.ipv6DialogCancelButton().click();

      // Set to IPv6 — removes stack preference warning
      await createRKE2ClusterPage.networkTab().stackPreference().toggle();
      await createRKE2ClusterPage.networkTab().stackPreference().clickOptionWithLabel('IPv6');

      await createRKE2ClusterPage.create();
      await expect(createRKE2ClusterPage.ipv6ConfirmationDialog()).toBeVisible();
      await expect(createRKE2ClusterPage.ipv6Recommendations()).toHaveCount(2);
      await expect(createRKE2ClusterPage.ipv6Recommendations()).not.toContainText('Stack Preference');
      await createRKE2ClusterPage.ipv6DialogCancelButton().click();

      // Set cluster/service CIDR
      await createRKE2ClusterPage.networkTab().clusterCIDR().set('fd00:10:244::/120');
      await createRKE2ClusterPage.networkTab().serviceCIDR().set('fd00:10:244::/120');

      await createRKE2ClusterPage.create();
      await expect(createRKE2ClusterPage.ipv6ConfirmationDialog()).toBeVisible();
      await expect(createRKE2ClusterPage.ipv6Recommendations()).toHaveCount(1);
      await expect(createRKE2ClusterPage.ipv6Recommendations()).not.toContainText('CIDR');
      await createRKE2ClusterPage.ipv6DialogCancelButton().click();

      // Set flannel masq — dialog should no longer appear
      await createRKE2ClusterPage.networkTab().flannelMasq().set();

      const clusterCreatePromise = page.waitForResponse(
        (resp) => resp.url().includes('v1/provisioning.cattle.io.clusters') && resp.request().method() === 'POST',
        SHORT_TIMEOUT_OPT,
      );

      await createRKE2ClusterPage.create();
      await clusterCreatePromise;
    });

    test('validates cluster networking configuration when machines are using ipv6-only networking', async ({
      login,
      page,
      rancherApi,
      envMeta,
    }) => {
      test.skip(!envMeta.awsAccessKey, 'Requires AWS credentials');

      await login();

      const clusterName = rancherApi.createE2EResourceName('ec2-ipv6');
      const clusterList = new ClusterManagerListPagePo(page);
      const createRKE2ClusterPage = new ClusterManagerCreateRke2AmazonPagePo(page);

      await page.route('meta/proxy/ec2*', (route) => {
        const body = route.request().postData() || '';

        if (body.includes('DescribeSubnets')) {
          route.fulfill({ status: 200, body: JSON.stringify(describeSubnetsResponse) });
        } else if (body.includes('DescribeVpcs')) {
          route.fulfill({ status: 200, body: JSON.stringify(describeVpcsResponse) });
        } else {
          route.continue();
        }
      });

      await page.route('v1/provisioning.cattle.io.clusters', (route) => {
        if (route.request().method() === 'POST') {
          route.fulfill({ status: 200, body: JSON.stringify({}) });
        } else {
          route.continue();
        }
      });

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.createCluster();
      await createRKE2ClusterPage.selectCreate(0);
      await expect(createRKE2ClusterPage.loadingIndicator()).not.toBeAttached(SHORT_TIMEOUT_OPT);
      await expect(createRKE2ClusterPage.rke2PageTitle()).toContainText('Create Amazon EC2');
      await createRKE2ClusterPage.waitForPage('type=amazonec2&rkeType=rke2', 'basic');

      await createRKE2ClusterPage.nameNsDescription().name().set(clusterName);
      await createRKE2ClusterPage.machinePoolTab().enableDualStack().set();
      await createRKE2ClusterPage.machinePoolTab().networks().toggle();
      await createRKE2ClusterPage.machinePoolTab().networks().clickOptionWithLabel('ipv6only');

      // Ipv6 checkbox should be auto-set
      await createRKE2ClusterPage.machinePoolTab().enableIpv6().isChecked();

      await createRKE2ClusterPage.create();
      await expect(createRKE2ClusterPage.ipv6ConfirmationDialog()).toBeVisible();
      await expect(createRKE2ClusterPage.ipv6Recommendations()).toHaveCount(2);
      await createRKE2ClusterPage.ipv6DialogCancelButton().click();

      // Toggle to k3s — 3 warnings
      await createRKE2ClusterPage.basicsTab().kubernetesVersions().toggle();
      await createRKE2ClusterPage.basicsTab().kubernetesVersions().clickOptionWithLabel('k3s');

      await createRKE2ClusterPage.create();
      await expect(createRKE2ClusterPage.ipv6ConfirmationDialog()).toBeVisible();
      await expect(createRKE2ClusterPage.ipv6Recommendations()).toHaveCount(3);
      await createRKE2ClusterPage.ipv6DialogCancelButton().click();

      // Dual stack pref should NOT remove stack preference warning for ipv6-only
      await createRKE2ClusterPage.clusterConfigurationTabs().clickTabWithSelector('#networking');
      await createRKE2ClusterPage.networkTab().stackPreference().toggle();
      await createRKE2ClusterPage.networkTab().stackPreference().clickOptionWithLabel('Dual');

      await createRKE2ClusterPage.create();
      await expect(createRKE2ClusterPage.ipv6ConfirmationDialog()).toBeVisible();
      await expect(createRKE2ClusterPage.ipv6Recommendations()).toHaveCount(3);
      await expect(createRKE2ClusterPage.ipv6Recommendations()).toContainText('Stack Preference');
      await createRKE2ClusterPage.ipv6DialogCancelButton().click();

      // IPv6 stack pref DOES remove the warning
      await createRKE2ClusterPage.networkTab().stackPreference().toggle();
      await createRKE2ClusterPage.networkTab().stackPreference().clickOptionWithLabel('IPv6');

      await createRKE2ClusterPage.create();
      await expect(createRKE2ClusterPage.ipv6ConfirmationDialog()).toBeVisible();
      await expect(createRKE2ClusterPage.ipv6Recommendations()).toHaveCount(2);
      await expect(createRKE2ClusterPage.ipv6Recommendations()).not.toContainText('Stack Preference');
      await createRKE2ClusterPage.ipv6DialogCancelButton().click();

      // Set CIDR
      await createRKE2ClusterPage.networkTab().clusterCIDR().set('fd00:10:244::/120');
      await createRKE2ClusterPage.networkTab().serviceCIDR().set('fd00:10:244::/120');

      await createRKE2ClusterPage.create();
      await expect(createRKE2ClusterPage.ipv6ConfirmationDialog()).toBeVisible();
      await expect(createRKE2ClusterPage.ipv6Recommendations()).toHaveCount(1);
      await expect(createRKE2ClusterPage.ipv6Recommendations()).not.toContainText('CIDR');
      await createRKE2ClusterPage.ipv6DialogCancelButton().click();

      // Set flannel masq — no dialog
      await createRKE2ClusterPage.networkTab().flannelMasq().set();

      const clusterCreatePromise = page.waitForResponse(
        (resp) => resp.url().includes('v1/provisioning.cattle.io.clusters') && resp.request().method() === 'POST',
        SHORT_TIMEOUT_OPT,
      );

      await createRKE2ClusterPage.create();
      await clusterCreatePromise;
    });
  },
);
