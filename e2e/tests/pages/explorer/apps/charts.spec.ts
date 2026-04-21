import { test, expect } from '@/support/fixtures';
import { ChartsPage } from '@/e2e/po/pages/explorer/charts/charts.po';
import { ChartPage } from '@/e2e/po/pages/explorer/charts/chart.po';
import ChartRepositoriesPagePo from '@/e2e/po/pages/chart-repositories.po';

const CLUSTER_REPOS_BASE_URL = 'v1/catalog.cattle.io.clusterrepos';

test.describe('Apps/Charts', { tag: ['@explorer', '@adminUser'] }, () => {
  test('Charts have expected icons', async ({ page, login }) => {
    await login();

    const chartsPage = new ChartsPage(page);

    await chartsPage.goTo();
    await chartsPage.waitForPage();
    await chartsPage.resetAllFilters();
    await chartsPage.checkChartGenericIcon('Alerting Driver', false);
    await chartsPage.checkChartGenericIcon('Rancher Compliance', false);
    await chartsPage.checkChartGenericIcon('Logging', false);
  });

  test('should call fetch when route query changes with valid parameters', async ({ page, login }) => {
    await login();

    const chartsPage = new ChartsPage(page);

    await chartsPage.goTo();
    await chartsPage.waitForPage();

    await expect(chartsPage.chartCards().first()).toBeVisible({ timeout: 30000 });

    const chartName = 'Logging';

    await chartsPage.clickChart(chartName);

    const chartPage = new ChartPage(page);

    await chartPage.waitForPage();

    const firstVersion = await chartPage.versionLinks().first().innerText();
    const fetchPromise = page.waitForResponse(
      (resp) => resp.url().includes(CLUSTER_REPOS_BASE_URL) && resp.request().method() === 'GET',
      { timeout: 15000 },
    );

    await chartPage.selectVersion(firstVersion.trim());
    const resp = await fetchPromise;

    expect(resp.status()).toBe(200);
  });

  test('should not call fetch when navigating back to charts page', async ({ page, login }) => {
    await login();

    const chartsPage = new ChartsPage(page);

    await chartsPage.goTo();
    await chartsPage.waitForPage();
    await expect(chartsPage.chartCards().first()).toBeVisible({ timeout: 30000 });

    await chartsPage.clickChart('Logging');

    const chartPage = new ChartPage(page);

    await chartPage.waitForPage();

    const requests: string[] = [];
    const handler = (req: import('@playwright/test').Request) => {
      if (req.url().includes(CLUSTER_REPOS_BASE_URL)) {
        requests.push(req.url());
      }
    };

    page.on('request', handler);

    await page.goBack();
    await chartsPage.waitForPage();

    page.off('request', handler);
    expect(requests.length).toBe(0);
  });

  test.skip('A disabled repo should NOT be listed on the list of repository filters', async ({ page, login }) => {
    await login();

    const appRepoList = new ChartRepositoriesPagePo(page, 'local', 'apps');

    await appRepoList.waitForGoTo(`${CLUSTER_REPOS_BASE_URL}?`);
    await appRepoList.sortableTable().checkLoadingIndicatorNotVisible();

    const actionMenu = await appRepoList.list().actionMenu('Partners');

    await actionMenu.getMenuItem('Disable').click();

    try {
      const chartsPage = new ChartsPage(page);

      await chartsPage.goTo();
      await chartsPage.waitForPage();
      await expect(chartsPage.chartCards().first()).toBeVisible({ timeout: 30000 });

      await expect(chartsPage.getFilterOptionByName('Rancher')).toBeAttached();
      await expect(chartsPage.getFilterOptionByName('RKE2')).toBeAttached();
      await expect(
        chartsPage.getAllOptionsByGroupName('Repository').filter({ hasText: 'Partners' }),
      ).not.toBeAttached();
    } finally {
      await appRepoList.waitForGoTo(`${CLUSTER_REPOS_BASE_URL}?`);
      await appRepoList.sortableTable().checkLoadingIndicatorNotVisible();
      const enableMenu = await appRepoList.list().actionMenu('Partners');

      await enableMenu.getMenuItem('Enable').click();
    }
  });

  test.skip('should display empty state properly', async ({ page, login }) => {
    await login();

    const chartsPage = new ChartsPage(page);

    await chartsPage.goTo();
    await chartsPage.waitForPage();
    await expect(chartsPage.chartCards().first()).toBeVisible({ timeout: 30000 });

    await chartsPage.getFilterOptionByName('Rancher').first().click();
    await chartsPage.getFilterOptionByName('PaaS').first().click();
    await chartsPage.getFilterOptionByName('Installed').first().click();

    await expect(chartsPage.emptyState()).toBeVisible();
    await expect(chartsPage.emptyStateTitle()).toContainText('No charts to show');

    await expect(chartsPage.emptyStateResetFilters()).toBeVisible();
    await chartsPage.emptyStateResetFilters().click();

    await expect(chartsPage.emptyState()).not.toBeAttached();
  });

  test('should load all charts when scrolling to the bottom', async ({ page, login }) => {
    await login();

    const chartsPage = new ChartsPage(page);

    await chartsPage.goTo();
    await chartsPage.waitForPage();
    await expect(chartsPage.chartCards().first()).toBeVisible({ timeout: 30000 });

    const totalCharts = await chartsPage.totalChartsCount();

    let prevCount = 0;

    for (let i = 0; i < 50; i++) {
      const currentCount = await chartsPage.chartCards().count();

      if (currentCount >= totalCharts) {
        break;
      }

      if (currentCount > prevCount) {
        prevCount = currentCount;
      }

      await chartsPage.scrollContainer().evaluate((el) => el.scrollTo(0, el.scrollHeight));
      // Brief pause needed for virtual-scroll render cycle after programmatic scroll
      await page.waitForTimeout(300);
    }

    await expect(chartsPage.chartCards()).toHaveCount(totalCharts, { timeout: 15000 });
  });
});

test.describe('Chart Details Page', { tag: ['@explorer', '@adminUser'] }, () => {
  const chartName = 'Logging';

  test('should navigate to the correct repository page', async ({ page, login, rancherApi }) => {
    await login();
    await rancherApi.setUserPreference({ 'show-pre-release': 'true' });

    try {
      const chartPage = new ChartPage(page);

      await chartPage.navTo(chartName);
      await chartPage.waitForPage();

      await chartPage.repoLink().click();
      await expect(page).toHaveURL(/\/c\/local\/apps\/catalog\.cattle\.io\.clusterrepo\/rancher-charts/);
    } finally {
      await rancherApi.setUserPreference({ 'show-pre-release': 'false' });
    }
  });

  test('should navigate to the charts list with the correct filters when a keyword is clicked', async ({
    page,
    login,
    rancherApi,
  }) => {
    await login();
    await rancherApi.setUserPreference({ 'show-pre-release': 'true' });

    try {
      const chartPage = new ChartPage(page);

      await chartPage.navTo(chartName);
      await chartPage.waitForPage();

      await chartPage.keywords().first().click();

      const chartsPage = new ChartsPage(page);

      await chartsPage.waitForPage();
      await expect(page).toHaveURL(/q=logging/);
    } finally {
      await rancherApi.setUserPreference({ 'show-pre-release': 'false' });
    }
  });

  test.skip('should show more versions when the button is clicked', async ({ page, login, rancherApi }) => {
    await login();
    await rancherApi.setUserPreference({ 'show-pre-release': 'true' });

    try {
      const chartPage = new ChartPage(page);

      await chartPage.navTo(chartName);
      await chartPage.waitForPage();

      const indexResult = await rancherApi.getRancherResource(
        'v1',
        'catalog.cattle.io.clusterrepos',
        'rancher-charts?link=index',
      );
      const entries = indexResult.body.entries;
      const rancherLoggingVersions = entries['rancher-logging'];
      const totalCount = rancherLoggingVersions.length;

      if (totalCount > 7) {
        await expect(chartPage.versionLinks()).toHaveCount(7);
        await chartPage.showMoreVersions().click();
        await expect(chartPage.versionLinks()).toHaveCount(totalCount);
      } else {
        await expect(chartPage.versionLinks()).toHaveCount(totalCount);
        await expect(chartPage.showMoreVersions()).not.toBeAttached();
      }
    } finally {
      await rancherApi.setUserPreference({ 'show-pre-release': 'false' });
    }
  });
});
