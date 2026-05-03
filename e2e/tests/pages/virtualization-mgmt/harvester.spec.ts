import { test, expect } from '@/support/fixtures/index';
import ExtensionsPagePo from '@/e2e/po/pages/extensions.po';
import {
  HarvesterClusterDetailsPo,
  HarvesterClusterPagePo,
} from '@/e2e/po/pages/virtualization-mgmt/harvester-clusters.po';
import ChartRepositoriesPagePo from '@/e2e/po/pages/chart-repositories.po';
import { EXTENSION_OPS, LONG, VERY_LONG } from '@/support/timeouts';

const CLUSTER_REPOS_BASE_URL = '/v1/catalog.cattle.io.clusterrepos';
const harvesterTitle = 'Harvester';

// Chart repository that supplies the Harvester UI extension differs for Community vs Prime
const HARVESTER_EXTENSION_CATALOG = {
  community: {
    repo: 'harvester',
    gitRepo: 'https://github.com/harvester/harvester-ui-extension.git',
    gitBranch: 'gh-pages',
  },
  prime: {
    repo: 'rancher',
    gitRepo: 'https://github.com/rancher/ui-plugin-charts',
    gitBranch: 'main',
  },
};

test.describe('Harvester', { tag: ['@virtualizationMgmt', '@adminUser'] }, () => {
  test.beforeEach(async ({ login, rancherApi }) => {
    // Clean up any leftover harvester state from previous runs
    await rancherApi.createRancherResource(
      'v1',
      'catalog.cattle.io.apps/cattle-ui-plugin-system/harvester?action=uninstall',
      {},
      false,
    );

    // Clean up both possible extension repos to prevent collisions
    const extensionRepoUrls = ['rancher/ui-plugin-charts', 'harvester/harvester-ui-extension'];
    const repos = await rancherApi.getRancherResource('v1', 'catalog.cattle.io.clusterrepos');

    for (const repo of repos.body.data ?? []) {
      if (extensionRepoUrls.some((url) => repo?.spec?.gitRepo?.includes(url))) {
        await rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', repo.id, false);
        await rancherApi.waitForRancherResource(
          'v1',
          'catalog.cattle.io.clusterrepos',
          repo.id,
          (resp) => resp.status === 404,
          10,
          3000,
        );
      }
    }

    await login();
  });

  test.afterEach(async ({ rancherApi, isPrime }) => {
    const catalog = isPrime ? HARVESTER_EXTENSION_CATALOG.prime : HARVESTER_EXTENSION_CATALOG.community;

    await rancherApi.createRancherResource(
      'v1',
      'catalog.cattle.io.apps/cattle-ui-plugin-system/harvester?action=uninstall',
      {},
      false,
    );
    await rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', catalog.repo, false);

    await rancherApi.waitForRancherResource(
      'v1',
      'catalog.cattle.io.apps',
      'cattle-ui-plugin-system/harvester',
      (resp) => resp.status === 404,
      30,
      5000,
    );
    await rancherApi.waitForRancherResource(
      'v1',
      'catalog.cattle.io.clusterrepos',
      catalog.repo,
      (resp) => resp.status === 404,
      20,
      3000,
    );
    await rancherApi.waitForHealthy();
  });

  test('can auto install harvester and begin process of importing a harvester cluster', async ({
    page,
    rancherApi,
    isPrime,
  }, testInfo) => {
    testInfo.setTimeout(EXTENSION_OPS);
    const catalog = isPrime ? HARVESTER_EXTENSION_CATALOG.prime : HARVESTER_EXTENSION_CATALOG.community;
    const chartRepo = catalog.repo;
    const harvesterPo = new HarvesterClusterPagePo(page);
    const extensionsPo = new ExtensionsPagePo(page);
    const appRepoList = new ChartRepositoriesPagePo(page, '_', 'manager');

    // verify install button and message displays
    await harvesterPo.goTo();
    await harvesterPo.waitForPage();
    await expect(harvesterPo.updateOrInstallButton().self()).toBeVisible();
    await expect(harvesterPo.extensionWarning()).toHaveText('The Harvester UI Extension is not installed');

    // Set up response listener for repo creation BEFORE clicking install
    const createHarvesterChartPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(CLUSTER_REPOS_BASE_URL) &&
        resp.request().method() === 'POST' &&
        !resp.url().includes('?action='),
      { timeout: VERY_LONG },
    );

    // install harvester extension
    await harvesterPo.updateOrInstallButton().click();

    const createResp = await createHarvesterChartPromise;

    expect(createResp.status()).toBe(201);

    // Poll API until extension is fully installed
    await rancherApi.waitForResourceState(
      'v1',
      'catalog.cattle.io.apps',
      'cattle-ui-plugin-system/harvester',
      'deployed',
      40,
    );
    await rancherApi.waitForRepositoryDownload('v1', 'catalog.cattle.io.clusterrepos', chartRepo, 30);

    await expect(harvesterPo.extensionWarning()).not.toBeAttached({ timeout: LONG });

    // verify harvester extension added to extensions page
    await extensionsPo.goTo();
    await extensionsPo.waitForPage(undefined, 'installed');
    await expect(extensionsPo.loading()).not.toBeAttached();
    await expect(extensionsPo.extensionCard(harvesterTitle)).toBeVisible();

    // verify harvester repo is added to repos list page
    await appRepoList.goTo();
    await appRepoList.waitForPage();
    await expect(appRepoList.list().resourceTable().sortableTable().rowElementWithName(chartRepo)).toBeVisible();
    await expect(appRepoList.list().state(chartRepo)).toContainText('Active', { timeout: VERY_LONG });

    // begin process of importing harvester cluster
    await harvesterPo.goTo();
    await harvesterPo.waitForPage();

    const createClusterPromise = page.waitForResponse(
      (resp) => resp.url().includes('/v3/clusters') && resp.request().method() === 'POST',
      { timeout: LONG },
    );

    await harvesterPo.importHarvesterClusterButton().click();

    const createEditForm = harvesterPo.createHarvesterClusterForm();

    await createEditForm.waitForPage(undefined, 'memberRoles');
    await expect(createEditForm.title()).toContainText('Harvester Cluster:');

    const harvesterClusterName = rancherApi.createE2EResourceName('harvesterclustername');

    await createEditForm.nameNsDescription().name().set(harvesterClusterName);
    await createEditForm.nameNsDescription().description().set(`${harvesterClusterName}-desc`);
    await createEditForm.resourceDetail().createEditView().createButton().click();

    const createClusterResp = await createClusterPromise;

    expect(createClusterResp.status()).toBe(201);

    const clusterBody = await createClusterResp.json();
    const harvesterClusterId = clusterBody.id;

    try {
      const harvesterDetails = new HarvesterClusterDetailsPo(page, undefined, undefined, harvesterClusterId);

      await harvesterDetails.waitForPage(undefined, 'registration');
      await expect(harvesterDetails.title()).toContainText(harvesterClusterName);

      // navigate to harvester list page and verify the logo and tagline do not display after cluster created
      await harvesterPo.navTo();
      await harvesterPo.waitForPage();
      await harvesterPo
        .list()
        .resourceTable()
        .sortableTable()
        .rowWithName(harvesterClusterName)
        .self()
        .scrollIntoViewIfNeeded();
      await expect(
        harvesterPo.list().resourceTable().sortableTable().rowWithName(harvesterClusterName).self(),
      ).toBeVisible();
      await expect(harvesterPo.harvesterLogo()).not.toBeAttached();
      await expect(harvesterPo.harvesterTagline()).not.toBeAttached();

      // #14285: Should be able to edit cluster here
      const actionMenu = await harvesterPo.list().actionMenu(harvesterClusterName);

      await expect(actionMenu.getMenuItem('Edit Config')).toBeAttached();
      await page.keyboard.press('Escape');
    } finally {
      // Delete both provisioning and management cluster, then wait for removal
      await rancherApi.deleteRancherResource(
        'v1',
        'provisioning.cattle.io.clusters',
        `fleet-default/${harvesterClusterId}`,
        false,
      );
      await rancherApi.deleteRancherResource('v3', 'clusters', harvesterClusterId, false);
      await rancherApi.waitForRancherResource(
        'v1',
        'provisioning.cattle.io.clusters',
        `fleet-default/${harvesterClusterId}`,
        (resp) => resp.status === 404,
        20,
        3000,
      );
    }
  });

  test('missing repo message should display when repo does NOT exist', async ({
    page,
    rancherApi,
    isPrime,
  }, testInfo) => {
    testInfo.setTimeout(EXTENSION_OPS);
    const catalog = isPrime ? HARVESTER_EXTENSION_CATALOG.prime : HARVESTER_EXTENSION_CATALOG.community;
    const chartRepo = catalog.repo;
    const harvesterPo = new HarvesterClusterPagePo(page);
    const extensionsPo = new ExtensionsPagePo(page);
    const appRepoList = new ChartRepositoriesPagePo(page, '_', 'manager');

    // add harvester repo
    await rancherApi.createRancherResource('v1', 'catalog.cattle.io.clusterrepos', {
      type: 'catalog.cattle.io.clusterrepo',
      metadata: { name: catalog.repo },
      spec: {
        clientSecret: null,
        gitRepo: catalog.gitRepo,
        gitBranch: catalog.gitBranch,
      },
    });

    // Wait for repository to be downloaded and ready
    await rancherApi.waitForRepositoryDownload('v1', 'catalog.cattle.io.clusterrepos', chartRepo);

    await appRepoList.goTo();
    await appRepoList.waitForPage();
    await expect(appRepoList.list().resourceTable().sortableTable().rowElementWithName(chartRepo)).toBeVisible();
    await expect(appRepoList.list().state(chartRepo)).toContainText('Active', { timeout: VERY_LONG });

    await extensionsPo.goTo();
    await extensionsPo.waitForPage(undefined, 'available');
    await expect(extensionsPo.loading()).not.toBeAttached();

    // click on install button on card
    await extensionsPo.extensionCardInstallClick(harvesterTitle);
    await expect(extensionsPo.installModal().self()).toBeVisible();

    // select latest version and click install
    await extensionsPo.installModal().selectVersionClick(1);
    await extensionsPo.installModal().installButton().click();

    // Poll until extension is fully deployed
    await rancherApi.waitForResourceState(
      'v1',
      'catalog.cattle.io.apps',
      'cattle-ui-plugin-system/harvester',
      'deployed',
      40,
    );

    await harvesterPo.goTo();
    await harvesterPo.waitForPage();

    await expect(harvesterPo.extensionWarning()).not.toBeAttached();

    // delete harvester repo
    await rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', chartRepo);

    await harvesterPo.goTo();
    await harvesterPo.waitForPage();
    // verify missing repo message displays
    await expect(harvesterPo.extensionWarning()).toHaveText('The Harvester UI Extension repository is missing');

    // uninstall harvester
    await rancherApi.createRancherResource(
      'v1',
      'catalog.cattle.io.apps/cattle-ui-plugin-system/harvester?action=uninstall',
      {},
    );

    // Poll until uninstall completes
    await rancherApi.waitForRancherResource(
      'v1',
      'catalog.cattle.io.apps',
      'cattle-ui-plugin-system/harvester',
      (resp) => resp.status === 404,
      30,
      3000,
    );

    // verify install button and message displays
    await harvesterPo.goTo();
    await harvesterPo.waitForPage();
    await expect(harvesterPo.updateOrInstallButton().self()).toBeVisible();
    await expect(harvesterPo.extensionWarning()).toHaveText('The Harvester UI Extension is not installed');
  });

  test('able to update harvester extension version', async ({ page, rancherApi, isPrime }, testInfo) => {
    testInfo.setTimeout(EXTENSION_OPS);
    const catalog = isPrime ? HARVESTER_EXTENSION_CATALOG.prime : HARVESTER_EXTENSION_CATALOG.community;
    const chartRepo = catalog.repo;
    const harvesterPo = new HarvesterClusterPagePo(page);
    const extensionsPo = new ExtensionsPagePo(page);
    const appRepoList = new ChartRepositoriesPagePo(page, '_', 'manager');

    // add harvester repo
    await rancherApi.createRancherResource('v1', 'catalog.cattle.io.clusterrepos', {
      type: 'catalog.cattle.io.clusterrepo',
      metadata: { name: catalog.repo },
      spec: {
        clientSecret: null,
        gitRepo: catalog.gitRepo,
        gitBranch: catalog.gitBranch,
      },
    });

    // Wait for repository to be downloaded and ready
    await rancherApi.waitForRepositoryDownload('v1', 'catalog.cattle.io.clusterrepos', chartRepo);

    await appRepoList.goTo();
    await appRepoList.waitForPage();
    await expect(appRepoList.list().resourceTable().sortableTable().rowElementWithName(chartRepo)).toBeVisible();
    await expect(appRepoList.list().state(chartRepo)).toContainText('Active', { timeout: VERY_LONG });

    await extensionsPo.goTo();
    await extensionsPo.waitForPage(undefined, 'available');
    await expect(extensionsPo.loading()).not.toBeAttached();

    // click on install button on card
    await extensionsPo.extensionCardInstallClick(harvesterTitle);
    await expect(extensionsPo.installModal().self()).toBeVisible();

    // Open version dropdown and get available versions
    await extensionsPo.installModal().versionLabelSelect().dropdown().click();
    const versions = await extensionsPo.installModal().getOptionsAsStrings();

    // select older version (index 2) and click install
    await extensionsPo.installModal().selectVersionClick(2, false);
    await extensionsPo.installModal().installButton().click();

    // Poll until extension is fully deployed
    await rancherApi.waitForResourceState(
      'v1',
      'catalog.cattle.io.apps',
      'cattle-ui-plugin-system/harvester',
      'deployed',
      40,
    );

    // Navigate to installed tab to verify version info
    await extensionsPo.goTo();
    await extensionsPo.waitForPage(undefined, 'installed');
    await expect(extensionsPo.loading()).not.toBeAttached({ timeout: LONG });

    // check harvester version on card - should be the latest available version
    await expect(extensionsPo.extensionCardVersion(harvesterTitle)).toContainText(versions[0]);

    // hover checkmark - tooltip should have older version
    await expect(await extensionsPo.extensionCardHeaderStatusTooltipText(harvesterTitle, 1)).toContainText(
      `Installed (${versions[1]})`,
    );

    await harvesterPo.goTo();
    await harvesterPo.waitForPage();

    // check for update harvester message
    await expect(harvesterPo.extensionWarning()).toHaveText(
      /^Your current Harvester UI Extension \(v[\d.]+\) is not the latest\.$/,
    );

    const upgradePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`${CLUSTER_REPOS_BASE_URL}/${chartRepo}?action=upgrade`) &&
        resp.request().method() === 'POST',
      { timeout: VERY_LONG },
    );

    await harvesterPo.updateOrInstallButton().click();

    const upgradeResp = await upgradePromise;

    expect(upgradeResp.status()).toBe(201);
    const upgradeReqBody = JSON.parse(upgradeResp.request().postData() || '{}');

    expect(upgradeReqBody?.charts?.[0]?.version).toBe(versions[0]);

    // Poll API until upgrade completes
    await rancherApi.waitForResourceState(
      'v1',
      'catalog.cattle.io.apps',
      'cattle-ui-plugin-system/harvester',
      'deployed',
      40,
    );

    // verify update button and message not displayed
    await expect(harvesterPo.extensionWarning()).not.toBeAttached();
    await expect(harvesterPo.updateOrInstallButton().self()).not.toBeAttached();

    await extensionsPo.goTo();
    await expect(page).toHaveURL(/uiplugins#installed/, { timeout: LONG });
    await expect(extensionsPo.loading()).not.toBeAttached({ timeout: LONG });
    // check harvester version on card after update - should be latest
    await expect(extensionsPo.extensionCardVersion(harvesterTitle)).toContainText(versions[0]);

    // hover checkmark - tooltip should have latest version
    await expect(await extensionsPo.extensionCardHeaderStatusTooltipText(harvesterTitle, 0)).toContainText(
      `Installed (${versions[0]})`,
    );
  });
});
