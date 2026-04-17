import { test, expect } from '@/support/fixtures';
import ExtensionsPagePo from '@/e2e/po/pages/extensions.po';
import { ChartsPage } from '@/e2e/po/pages/explorer/charts/charts.po';
import ChartRepositoriesPagePo from '@/e2e/po/pages/chart-repositories.po';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';
import KubewardenExtensionPo from '@/e2e/po/pages/extensions/kubewarden.po';

const extensionName = 'kubewarden';
const gitRepoName = 'rancher-extensions';
const gitRepoUrl = 'https://github.com/rancher/ui-plugin-charts';

test.describe('Kubewarden Extension', { tag: ['@extensions', '@adminUser'] }, () => {
  let kubewardenAvailable = false;

  test.beforeAll(async ({ rancherApi }) => {
    // Ensure the ui-plugin-charts repo exists
    const existing = await rancherApi.getRancherResource('v1', 'catalog.cattle.io.clusterrepos', gitRepoName, 0);

    if (existing.status !== 200) {
      await rancherApi.createRancherResource('v1', 'catalog.cattle.io.clusterrepos', {
        type: 'catalog.cattle.io.clusterrepo',
        metadata: { name: gitRepoName },
        spec: { clientSecret: null, gitRepo: gitRepoUrl, gitBranch: 'main' },
      });

      await rancherApi.waitForRepositoryDownload('v1', 'catalog.cattle.io.clusterrepos', gitRepoName);
    }

    // Check if kubewarden extension is actually available in this repo
    const repoResp = await rancherApi.getRancherResource('v1', 'catalog.cattle.io.clusterrepos', gitRepoName, 0);

    kubewardenAvailable = JSON.stringify(repoResp.body?.status?.indexedCharts || {}).includes(extensionName);
  });

  test.afterAll(async ({ rancherApi }) => {
    // Uninstall kubewarden if installed
    await rancherApi.createRancherResource(
      'v1',
      `catalog.cattle.io.apps/cattle-ui-plugin-system/${extensionName}?action=uninstall`,
      {},
      false
    );

    // Remove the repo
    await rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', gitRepoName, false);
  });

  test.beforeEach(async ({ login }) => {
    test.skip(!kubewardenAvailable, 'Kubewarden extension not available in ui-plugin-charts repo');
    await login();
  });

  test('Should install Kubewarden extension', async ({ page }) => {
    const extensionsPo = new ExtensionsPagePo(page);

    await extensionsPo.goTo();
    await extensionsPo.waitForPage();

    const installedTabRendered = await extensionsPo.checkForExtensionTab('installed');

    if (!installedTabRendered) {
      await extensionsPo.installExtensionFromCatalog(extensionName);
      await verifyKubewardenInstalledDetails(extensionsPo);

      return;
    }

    await extensionsPo.extensionTabInstalledClick();
    await extensionsPo.waitForPage(undefined, 'installed');

    const kubewardenCardPresent = await extensionsPo.checkForExtensionCardWithName(extensionName);

    if (kubewardenCardPresent) {
      await extensionsPo.extensionCardClick(extensionName);
      await expect(extensionsPo.extensionDetailsTitle()).toContainText(extensionName);
      await extensionsPo.extensionDetailsCloseClick();
    } else {
      await extensionsPo.installExtensionFromCatalog(extensionName);
      await verifyKubewardenInstalledDetails(extensionsPo);
    }
  });

  test('Check Apps/Charts and Apps/Repo pages for route collisions', async ({ page }) => {
    const chartsPage = new ChartsPage(page);

    await chartsPage.goTo();
    await chartsPage.waitForPage();
    await expect(chartsPage.headerTitle()).toContainText('Charts');

    const appRepoList = new ChartRepositoriesPagePo(page, 'local', 'apps');

    await appRepoList.goTo();
    await appRepoList.waitForPage();
    await appRepoList.waitForMastheadTitle('Repositories');
  });

  test('Side-nav should contain Kubewarden menu item', async ({ page }) => {
    const kubewardenPo = new KubewardenExtensionPo(page);
    const productMenu = new ProductNavPo(page);

    await kubewardenPo.goTo();
    await kubewardenPo.waitForPage();

    const kubewardenNavItem = productMenu.groups().filter({ hasText: 'Admission Policy Management' });

    await expect(kubewardenNavItem).toBeAttached();
    await kubewardenNavItem.click();
  });

  test('Kubewarden dashboard view should exist', async ({ page }) => {
    const kubewardenPo = new KubewardenExtensionPo(page);

    await kubewardenPo.goTo();
    await kubewardenPo.waitForPage();

    await expect(kubewardenPo.dashboardTitle()).toBeAttached();
    await expect(kubewardenPo.installButton()).toBeAttached();
  });

  test('Should uninstall Kubewarden', async ({ page }) => {
    const extensionsPo = new ExtensionsPagePo(page);

    await extensionsPo.goTo();
    await extensionsPo.waitForPage();

    await extensionsPo.waitForTabs();
    await extensionsPo.extensionTabInstalledClick();

    await extensionsPo.extensionCardUninstallClick(extensionName);
    await expect(extensionsPo.extensionUninstallModal()).toBeVisible();
    await extensionsPo.uninstallModalUninstallClick();

    await expect(extensionsPo.extensionReloadBanner()).toBeVisible();
    await extensionsPo.extensionReloadClick();

    await extensionsPo.extensionTabAvailableClick();
    await extensionsPo.extensionCardClick(extensionName);
    await expect(extensionsPo.extensionDetailsTitle()).toContainText(extensionName);
  });
});

async function verifyKubewardenInstalledDetails(extensionsPo: ExtensionsPagePo): Promise<void> {
  await extensionsPo.waitForTabs();
  await extensionsPo.extensionTabInstalledClick();
  await extensionsPo.waitForPage(undefined, 'installed');
  await extensionsPo.extensionCardClick('kubewarden');
  await expect(extensionsPo.extensionDetailsTitle()).toContainText('kubewarden');
  await extensionsPo.extensionDetailsCloseClick();
}
