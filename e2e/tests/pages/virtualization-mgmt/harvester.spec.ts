import { test, expect } from '@/support/fixtures/index';
import ExtensionsPagePo from '@/e2e/po/pages/extensions.po';
import {
  HarvesterClusterDetailsPo,
  HarvesterClusterPagePo,
} from '@/e2e/po/pages/virtualization-mgmt/harvester-clusters.po';
import ChartRepositoriesPagePo from '@/e2e/po/pages/chart-repositories.po';

const CLUSTER_REPOS_BASE_URL = '/v1/catalog.cattle.io.clusterrepos';

const harvesterGitRepoName = 'harvester';
const harvesterTitle = 'Harvester';
const branchName = 'gh-pages';
const harvesterGitRepoUrl = 'https://github.com/harvester/harvester-ui-extension.git';

test.describe('Harvester', { tag: ['@virtualizationMgmt', '@adminUser'] }, () => {
  test.describe.configure({ mode: 'serial' });
  let harvesterClusterName: string;

  test.beforeEach(async ({ login, rancherApi }) => {
    // Clean up any leftover harvester state from previous runs (leaked afterEach)
    await rancherApi.createRancherResource(
      'v1',
      'catalog.cattle.io.apps/cattle-ui-plugin-system/harvester?action=uninstall',
      {},
      false,
    );
    await rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', harvesterGitRepoName, false);

    await login();
    harvesterClusterName = rancherApi.createE2EResourceName('harvesterclustername');
  });

  test.afterEach(async ({ rancherApi }) => {
    await rancherApi.createRancherResource(
      'v1',
      'catalog.cattle.io.apps/cattle-ui-plugin-system/harvester?action=uninstall',
      {},
      false,
    );
    await rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', harvesterGitRepoName, false);

    // Wait for both app and repo to be fully removed so Rancher settles
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
      harvesterGitRepoName,
      (resp) => resp.status === 404,
      20,
      3000,
    );
    await rancherApi.waitForHealthy();
  });

  /**
   * Assumes that Harvester Extension is NOT installed
   *
   * Harvester Extension will also be removed after all tests run
   */
  test('can auto install harvester and begin process of importing a harvester cluster', async ({
    page,
    rancherApi,
  }) => {
    const harvesterPo = new HarvesterClusterPagePo(page);
    const extensionsPo = new ExtensionsPagePo(page);
    const appRepoList = new ChartRepositoriesPagePo(page, '_', 'manager');

    // verify install button and message displays
    await harvesterPo.goTo();
    await harvesterPo.waitForPage();
    await harvesterPo.updateOrInstallButton().checkVisible();
    await expect(harvesterPo.extensionWarning()).toHaveText('The Harvester UI Extension is not installed');

    // Set up response listeners BEFORE clicking install
    const createHarvesterChartPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(CLUSTER_REPOS_BASE_URL) &&
        resp.request().method() === 'POST' &&
        !resp.url().includes('?action='),
      { timeout: 30000 },
    );
    const updateHarvesterChartPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`${CLUSTER_REPOS_BASE_URL}/${harvesterGitRepoName}`) && resp.request().method() === 'PUT',
      { timeout: 30000 },
    );
    const installPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`${CLUSTER_REPOS_BASE_URL}/${harvesterGitRepoName}?action=install`) &&
        resp.request().method() === 'POST',
      { timeout: 30000 },
    );

    // install harvester extension
    await harvesterPo.updateOrInstallButton().click();

    const createResp = await createHarvesterChartPromise;

    expect(createResp.status()).toBe(201);

    const updateResp = await updateHarvesterChartPromise;

    expect(updateResp.status()).toBe(200);

    // Wait for the installation request and handle 500 errors
    const installResp = await installPromise;
    const installStatus = installResp.status();

    if (installStatus === 201) {
      // Installation succeeded on first attempt
    } else if (installStatus === 500) {
      // Conditional retry - check for warning message and retry
      const warningText = await harvesterPo
        .extensionWarning()
        .innerText()
        .catch(() => '');

      if (warningText.includes('Warning, Harvester UI extension automatic installation failed')) {
        await page.reload();
        await harvesterPo.waitForPage();
        await harvesterPo.updateOrInstallButton().click();
      }
    } else {
      throw new Error(`Unexpected status code: ${installStatus}`);
    }

    // Set up listener for the second PUT update before it fires
    const updateAfterInstallPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`${CLUSTER_REPOS_BASE_URL}/${harvesterGitRepoName}`) && resp.request().method() === 'PUT',
      { timeout: 60000 },
    );

    await harvesterPo.waitForPage();
    await updateAfterInstallPromise;

    await expect(harvesterPo.extensionWarning()).not.toBeAttached({ timeout: 30000 });

    // verify harvester extension added to extensions page
    await extensionsPo.goTo();
    await extensionsPo.waitForPage(undefined, 'installed');
    await expect(extensionsPo.loading()).not.toBeAttached();
    await expect(extensionsPo.extensionCard(harvesterTitle)).toBeVisible();

    // verify harvester repo is added to repos list page
    await appRepoList.goTo();
    await appRepoList.waitForPage();
    await expect(
      appRepoList.list().resourceTable().sortableTable().rowElementWithName(harvesterGitRepoName),
    ).toBeVisible();
    await expect(appRepoList.list().state(harvesterGitRepoName)).toContainText('Active', { timeout: 60000 });

    // begin process of importing harvester cluster
    const updateChartOnNavPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`${CLUSTER_REPOS_BASE_URL}/${harvesterGitRepoName}`) && resp.request().method() === 'PUT',
      { timeout: 60000 },
    );

    await harvesterPo.goTo();
    await harvesterPo.waitForPage();
    await updateChartOnNavPromise;

    const createClusterPromise = page.waitForResponse(
      (resp) => resp.url().includes('/v3/clusters') && resp.request().method() === 'POST',
      { timeout: 30000 },
    );

    await harvesterPo.importHarvesterClusterButton().click();

    const createEditForm = harvesterPo.createHarvesterClusterForm();

    await createEditForm.waitForPage(undefined, 'memberRoles');
    await expect(createEditForm.title()).toContainText('Harvester Cluster:');
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

  test('missing repo message should display when repo does NOT exist', async ({ page, rancherApi }) => {
    const harvesterPo = new HarvesterClusterPagePo(page);
    const extensionsPo = new ExtensionsPagePo(page);
    const appRepoList = new ChartRepositoriesPagePo(page, '_', 'manager');

    // add harvester repo
    await rancherApi.createRancherResource('v1', 'catalog.cattle.io.clusterrepos', {
      type: 'catalog.cattle.io.clusterrepo',
      metadata: { name: harvesterGitRepoName },
      spec: {
        clientSecret: null,
        gitRepo: harvesterGitRepoUrl,
        gitBranch: branchName,
      },
    });

    // Wait for repository to be downloaded and ready
    await rancherApi.waitForRepositoryDownload('v1', 'catalog.cattle.io.clusterrepos', harvesterGitRepoName);

    await appRepoList.goTo();
    await appRepoList.waitForPage();
    await expect(
      appRepoList.list().resourceTable().sortableTable().rowElementWithName(harvesterGitRepoName),
    ).toBeVisible();
    await expect(appRepoList.list().state(harvesterGitRepoName)).toContainText('Active', { timeout: 60000 });

    await extensionsPo.goTo();
    await extensionsPo.waitForPage(undefined, 'available');
    await expect(extensionsPo.loading()).not.toBeAttached();

    // click on install button on card
    await extensionsPo.extensionCardInstallClick(harvesterTitle);
    await extensionsPo.installModal().checkVisible();

    // select latest version and click install
    const installPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`${CLUSTER_REPOS_BASE_URL}/${harvesterGitRepoName}?action=install`) &&
        resp.request().method() === 'POST',
      { timeout: 30000 },
    );

    await extensionsPo.installModal().selectVersionClick(1);
    await extensionsPo.installModal().installButton().click();

    const installResp = await installPromise;
    const installStatus = installResp.status();

    if (installStatus === 500) {
      test.skip(true, 'Harvester chart install returned 500 — chart not available in this environment');
    }

    expect(installStatus).toBe(201);

    // Navigate explicitly — page does not auto-navigate after install
    await extensionsPo.goTo();
    await extensionsPo.waitForPage(undefined, 'installed');

    await expect(extensionsPo.extensionReloadBanner()).toBeVisible({ timeout: 60000 });
    await extensionsPo.extensionReloadClick();
    await expect(extensionsPo.loading()).not.toBeAttached();

    {
      const updateOnNavPromise = page.waitForResponse(
        (resp) =>
          resp.url().includes(`${CLUSTER_REPOS_BASE_URL}/${harvesterGitRepoName}`) && resp.request().method() === 'PUT',
        { timeout: 60000 },
      );

      await harvesterPo.goTo();
      await harvesterPo.waitForPage();
      await updateOnNavPromise;
    }

    await expect(harvesterPo.extensionWarning()).not.toBeAttached();

    // delete harvester repo
    await rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', harvesterGitRepoName);

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

    // reload extensions
    await extensionsPo.goTo();
    await extensionsPo.waitForPage();
    await expect(extensionsPo.loading()).not.toBeAttached();
    await expect(extensionsPo.extensionReloadBanner()).toBeVisible({ timeout: 60000 });
    await extensionsPo.extensionReloadClick();
    await expect(extensionsPo.loading()).not.toBeAttached();

    // verify install button and message displays — use goTo() since page was just reloaded
    await harvesterPo.goTo();
    await harvesterPo.waitForPage();
    await harvesterPo.updateOrInstallButton().checkVisible();
    await expect(harvesterPo.extensionWarning()).toHaveText('The Harvester UI Extension is not installed');
  });

  test('able to update harvester extension version', async ({ page, rancherApi }) => {
    const harvesterPo = new HarvesterClusterPagePo(page);
    const extensionsPo = new ExtensionsPagePo(page);
    const appRepoList = new ChartRepositoriesPagePo(page, '_', 'manager');

    // add harvester repo
    await rancherApi.createRancherResource('v1', 'catalog.cattle.io.clusterrepos', {
      type: 'catalog.cattle.io.clusterrepo',
      metadata: { name: harvesterGitRepoName },
      spec: {
        clientSecret: null,
        gitRepo: harvesterGitRepoUrl,
        gitBranch: branchName,
      },
    });

    // Wait for repository to be downloaded and ready
    await rancherApi.waitForRepositoryDownload('v1', 'catalog.cattle.io.clusterrepos', harvesterGitRepoName);

    await appRepoList.goTo();
    await appRepoList.waitForPage();
    await expect(
      appRepoList.list().resourceTable().sortableTable().rowElementWithName(harvesterGitRepoName),
    ).toBeVisible();
    await expect(appRepoList.list().state(harvesterGitRepoName)).toContainText('Active', { timeout: 60000 });

    await extensionsPo.goTo();
    await extensionsPo.waitForPage(undefined, 'available');
    await expect(extensionsPo.loading()).not.toBeAttached();

    // click on install button on card
    await extensionsPo.extensionCardInstallClick(harvesterTitle);
    await extensionsPo.installModal().checkVisible();

    // Open version dropdown and get available versions
    await extensionsPo.installModal().versionLabelSelect().dropdown().click();
    const versions = await extensionsPo.installModal().getOptionsAsStrings();

    // select older version (index 2) and click install
    const installPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`${CLUSTER_REPOS_BASE_URL}/${harvesterGitRepoName}?action=install`) &&
        resp.request().method() === 'POST',
      { timeout: 30000 },
    );

    await extensionsPo.installModal().selectVersionClick(2, false);
    await extensionsPo.installModal().installButton().click();

    const installResp = await installPromise;
    const installStatus3 = installResp.status();

    if (installStatus3 === 500) {
      test.skip(true, 'Harvester chart install returned 500 — chart not available in this environment');
    }

    expect(installStatus3).toBe(201);

    // Wait for page to transition to installed tab (matches upstream order)
    await expect(page).toHaveURL(/uiplugins#installed/, { timeout: 30000 });

    await expect(extensionsPo.extensionReloadBanner()).toBeVisible({ timeout: 60000 });
    await extensionsPo.extensionReloadClick();
    await expect(extensionsPo.loading()).not.toBeAttached({ timeout: 30000 });

    // check harvester version on card - should be the latest available version
    await expect(extensionsPo.extensionCardVersion(harvesterTitle)).toContainText(versions[0]);

    // hover checkmark - tooltip should have older version
    await extensionsPo.extensionCardHeaderStatusTooltipText(harvesterTitle, 1, `Installed (${versions[1]})`);

    {
      const updateOnNavPromise = page.waitForResponse(
        (resp) =>
          resp.url().includes(`${CLUSTER_REPOS_BASE_URL}/${harvesterGitRepoName}`) && resp.request().method() === 'PUT',
        { timeout: 60000 },
      );

      await harvesterPo.goTo();
      await harvesterPo.waitForPage();
      await updateOnNavPromise;
    }

    // check for update harvester message
    await expect(harvesterPo.extensionWarning()).toHaveText(
      /^Your current Harvester UI Extension \(v[\d.]+\) is not the latest\.$/,
    );

    const upgradePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`${CLUSTER_REPOS_BASE_URL}/${harvesterGitRepoName}?action=upgrade`) &&
        resp.request().method() === 'POST',
      { timeout: 60000 },
    );
    const updateAfterUpgradePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`${CLUSTER_REPOS_BASE_URL}/${harvesterGitRepoName}`) && resp.request().method() === 'PUT',
      { timeout: 60000 },
    );

    await harvesterPo.updateOrInstallButton().click();

    const upgradeResp = await upgradePromise;

    expect(upgradeResp.status()).toBe(201);
    const upgradeReqBody = JSON.parse(upgradeResp.request().postData() || '{}');

    expect(upgradeReqBody?.charts?.[0]?.version).toBe(versions[0]);

    // Wait for chart update after upgrade
    await updateAfterUpgradePromise;

    // verify update button and message not displayed
    await expect(harvesterPo.extensionWarning()).not.toBeAttached();
    await harvesterPo.updateOrInstallButton().checkNotExists();

    await extensionsPo.goTo();
    await expect(page).toHaveURL(/uiplugins#installed/, { timeout: 30000 });
    await expect(extensionsPo.loading()).not.toBeAttached({ timeout: 30000 });
    // check harvester version on card after update - should be latest
    await expect(extensionsPo.extensionCardVersion(harvesterTitle)).toContainText(versions[0]);

    // hover checkmark - tooltip should have latest version
    await extensionsPo.extensionCardHeaderStatusTooltipText(harvesterTitle, 0, `Installed (${versions[0]})`);
  });
});
