import { test, expect } from '@/support/fixtures';
import ClusterToolsPagePo from '@/e2e/po/pages/explorer/cluster-tools.po';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import CreateEditViewPo from '@/e2e/po/components/create-edit-view.po';

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

    await expect(cards).not.toHaveCount(0);
    const count = await cards.count();

    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('can deploy chart successfully', { tag: '@flaky' }, async ({ page, rancherApi }) => {
    test.setTimeout(120000);

    await rancherApi.createRancherResource(
      'v1',
      'catalog.cattle.io.apps/default/rancher-alerting-drivers?action=uninstall',
      {},
      false,
    );
    await rancherApi.waitForRancherResource(
      'v1',
      'catalog.cattle.io.apps',
      'default/rancher-alerting-drivers',
      (resp) => resp.status === 404,
      20,
      1500,
    );

    const clusterTools = new ClusterToolsPagePo(page, 'local');

    await clusterTools.goTo();
    await clusterTools.waitForPage();

    const chartVersion = (await clusterTools.getChartVersion('Alerting Drivers').textContent())?.trim();

    await clusterTools.goToInstall('Alerting Drivers');

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

  test('can edit chart successfully', { tag: '@flaky' }, async ({ page }) => {
    test.setTimeout(120000);
    const clusterTools = new ClusterToolsPagePo(page, 'local');

    await clusterTools.goTo();
    await clusterTools.waitForPage();
    await clusterTools.editChart('Alerting Drivers');

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

  test('can uninstall chart successfully', { tag: '@flaky' }, async ({ page }) => {
    test.setTimeout(120000);
    const clusterTools = new ClusterToolsPagePo(page, 'local');

    await clusterTools.goTo();
    await clusterTools.waitForPage();
    await clusterTools.deleteChart('Alerting Drivers');

    const responsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('catalog.cattle.io.apps/default/rancher-alerting-drivers?action=uninstall') &&
        resp.request().method() === 'POST',
    );

    const promptRemove = new PromptRemove(page);

    await promptRemove.remove();

    const response = await responsePromise;

    expect(response.status()).toBe(201);
  });
});
