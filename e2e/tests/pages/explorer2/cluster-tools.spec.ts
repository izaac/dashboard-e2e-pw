import { test, expect } from '@/support/fixtures';
import ClusterToolsPagePo from '@/e2e/po/pages/explorer/cluster-tools.po';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import CreateEditViewPo from '@/e2e/po/components/create-edit-view.po';

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

  test.describe('Alerting Drivers chart lifecycle', { tag: '@flaky' }, () => {
    test.beforeEach(async ({ rancherApi }) => {
      // Skip if chart is not available in the catalog
      const resp = await rancherApi.getRancherResource(
        'v1',
        'catalog.cattle.io.clusterrepos/rancher-charts?link=index',
      );
      const entries = resp.body?.entries || {};
      const chartAvailable = Boolean(entries[chartKey]);

      test.skip(!chartAvailable, `Chart "${chartKey}" not available in rancher-charts catalog`);
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

      await clusterTools.goTo();
      await clusterTools.waitForPage();

      const chartVersionLocator = clusterTools.getChartVersion(chartName);

      await expect(chartVersionLocator).not.toHaveText('');

      await clusterTools.goToInstall(chartName);

      const responsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('v1/catalog.cattle.io.clusterrepos/rancher-charts?action=install') &&
          resp.request().method() === 'POST',
      );

      const formSave = new CreateEditViewPo(page, '.dashboard-root');

      await formSave.formSave().click();
      await formSave.formSave().click();

      const response = await responsePromise;

      expect(response.status()).toBe(201);
      await clusterTools.waitForPage();
    });

    test('can edit chart successfully', async ({ page }) => {
      test.setTimeout(120000);
      const clusterTools = new ClusterToolsPagePo(page, 'local');

      await clusterTools.goTo();
      await clusterTools.waitForPage();
      await clusterTools.editChart(chartName);

      const responsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('v1/catalog.cattle.io.clusterrepos/rancher-charts?action=upgrade') &&
          resp.request().method() === 'POST',
      );

      const formSave = new CreateEditViewPo(page, '.dashboard-root');

      await formSave.formSave().click();
      await formSave.formSave().click();

      const response = await responsePromise;

      expect(response.status()).toBe(201);
      await clusterTools.waitForPage();
    });

    test('can uninstall chart successfully', async ({ page }) => {
      test.setTimeout(120000);
      const clusterTools = new ClusterToolsPagePo(page, 'local');

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
    });
  });
});
