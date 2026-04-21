import { test, expect } from '@/support/fixtures';
import ClusterToolsPagePo from '@/e2e/po/pages/explorer/cluster-tools.po';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import { InstallChartPage } from '@/e2e/po/pages/explorer/charts/install-charts.po';
import KubectlPo from '@/e2e/po/components/kubectl.po';

const chartName = 'Alerting Drivers';
const chartKey = 'rancher-alerting-drivers';

test.describe('Cluster Tools', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('can navigate to cluster tools and see all feature charts', async ({ page }) => {
    const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

    await clusterDashboard.goTo();
    await clusterDashboard.waitForPage();
    await clusterDashboard.navToSideMenuEntryByLabel('Tools');

    const clusterTools = new ClusterToolsPagePo(page, 'local');

    await clusterTools.waitForPage();

    const cards = clusterTools.featureChartCards();

    await expect(cards.first()).toBeVisible();
    const count = await cards.count();

    expect(count).toBeGreaterThanOrEqual(1);
  });

  test.describe('Alerting Drivers chart lifecycle', () => {
    test.beforeEach(async ({ chartGuard }) => {
      await chartGuard('rancher-charts', chartKey);
    });

    test('can deploy chart successfully', async ({ page, rancherApi }) => {
      test.setTimeout(120000);

      // Ensure chart is uninstalled before deploying
      await rancherApi.createRancherResource(
        'v1',
        `catalog.cattle.io.apps/default/${chartKey}?action=uninstall`,
        {},
        false,
      );
      await rancherApi.waitForRancherResource(
        'v1',
        'catalog.cattle.io.apps',
        `default/${chartKey}`,
        (resp) => resp.status === 404,
        20,
        1500,
      );

      const clusterTools = new ClusterToolsPagePo(page, 'local');
      const installChartPage = new InstallChartPage(page);
      const terminal = new KubectlPo(page);

      await clusterTools.goTo();
      await clusterTools.waitForPage();

      const chartVersionLocator = clusterTools.getChartVersion(chartName);

      await expect(chartVersionLocator).not.toHaveText('');

      await clusterTools.goToInstall(chartName);
      await installChartPage.nextPage();

      const responsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('v1/catalog.cattle.io.clusterrepos/rancher-charts?action=install') &&
          resp.request().method() === 'POST',
      );

      await installChartPage.installChart();

      const response = await responsePromise;

      expect(response.status()).toBe(201);

      await terminal.waitForTerminalStatus('Disconnected', 60000);
      await terminal.closeTerminal();
      await clusterTools.waitForPage();
    });

    test('can edit chart successfully', async ({ page }) => {
      test.setTimeout(120000);
      const clusterTools = new ClusterToolsPagePo(page, 'local');
      const installChartPage = new InstallChartPage(page);
      const terminal = new KubectlPo(page);

      await clusterTools.goTo();
      await clusterTools.waitForPage();
      await clusterTools.editChart(chartName);

      await installChartPage.nextPage();

      const responsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('v1/catalog.cattle.io.clusterrepos/rancher-charts?action=upgrade') &&
          resp.request().method() === 'POST',
      );

      await installChartPage.installChart();

      const response = await responsePromise;

      expect(response.status()).toBe(201);

      await terminal.waitForTerminalStatus('Disconnected', 60000);
      await terminal.closeTerminal();
      await clusterTools.waitForPage();
    });

    test('can uninstall chart successfully', async ({ page }) => {
      test.setTimeout(120000);
      const clusterTools = new ClusterToolsPagePo(page, 'local');
      const terminal = new KubectlPo(page);

      await clusterTools.goTo();
      await clusterTools.waitForPage();
      await clusterTools.deleteChart(chartName);

      const responsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes(`catalog.cattle.io.apps/default/${chartKey}?action=uninstall`) &&
          resp.request().method() === 'POST',
      );

      const promptRemove = new PromptRemove(page);

      await promptRemove.remove();

      const response = await responsePromise;

      expect(response.status()).toBe(201);

      await terminal.waitForTerminalStatus('Disconnected', 60000);
      await terminal.closeTerminal();
    });

    test.afterAll(async ({ rancherApi }) => {
      // Cleanup: ensure chart is uninstalled regardless of test outcome
      await rancherApi.createRancherResource(
        'v1',
        `catalog.cattle.io.apps/default/${chartKey}?action=uninstall`,
        {},
        false,
      );
    });
  });
});
