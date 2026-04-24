import { test, expect } from '@/support/fixtures';
import { ChartsPage } from '@/e2e/po/pages/explorer/charts/charts.po';
import { ChartPage } from '@/e2e/po/pages/explorer/charts/chart.po';
import ChartRepositoriesPagePo from '@/e2e/po/pages/chart-repositories.po';
import { SHORT_TIMEOUT_OPT, POLL_ITERATION_TIMEOUT } from '@/support/utils/timeouts';
import { LONG } from '@/support/timeouts';

const CLUSTER_REPOS_BASE_URL = 'v1/catalog.cattle.io.clusterrepos';

test.describe('Apps/Charts', { tag: ['@explorer', '@adminUser'] }, () => {
  test('Charts have expected icons', async ({ page, login, chartGuard }) => {
    await chartGuard('rancher-charts', 'rancher-alerting-drivers');
    await login();

    const chartsPage = new ChartsPage(page);

    await chartsPage.goTo();
    await chartsPage.waitForPage();
    await chartsPage.resetAllFilters();
    await expect(chartsPage.chartCardImage('Alerting Driver')).toBeVisible();
    await expect(chartsPage.chartCardImage('Rancher Compliance')).toBeVisible();
    await expect(chartsPage.chartCardImage('Logging')).toBeVisible();
  });

  test('should call fetch when route query changes with valid parameters', async ({ page, login, chartGuard }) => {
    await chartGuard('rancher-charts', 'rancher-logging');
    await login();

    const chartsPage = new ChartsPage(page);

    await chartsPage.goTo();
    await chartsPage.waitForPage();

    await expect(chartsPage.chartCards().first()).toBeVisible({ timeout: LONG });

    const chartName = 'Logging';

    await chartsPage.clickChart(chartName);

    const chartPage = new ChartPage(page);

    await chartPage.waitForPage();

    const firstVersion = await chartPage.versionLinks().first().innerText();
    const fetchPromise = page.waitForResponse(
      (resp) => resp.url().includes(CLUSTER_REPOS_BASE_URL) && resp.request().method() === 'GET',
      SHORT_TIMEOUT_OPT,
    );

    await chartPage.selectVersion(firstVersion.trim());
    const resp = await fetchPromise;

    expect(resp.status()).toBe(200);
  });

  test('should not call fetch when navigating back to charts page', async ({ page, login, chartGuard }) => {
    await chartGuard('rancher-charts', 'rancher-logging');
    await login();

    const chartsPage = new ChartsPage(page);

    await chartsPage.goTo();
    await chartsPage.waitForPage();
    await expect(chartsPage.chartCards().first()).toBeVisible({ timeout: LONG });

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

  test('A disabled repo should NOT be listed on the list of repository filters', async ({
    page,
    login,
    rancherApi,
  }) => {
    await login();

    const appRepoList = new ChartRepositoriesPagePo(page, 'local', 'apps');

    await appRepoList.goTo();
    await appRepoList.sortableTable().checkLoadingIndicatorNotVisible();

    const actionMenu = await appRepoList.list().actionMenu('Partners');

    await actionMenu.getMenuItem('Disable').click();

    try {
      const chartsPage = new ChartsPage(page);

      await chartsPage.goTo();
      await chartsPage.waitForPage();
      await expect(chartsPage.chartCards().first()).toBeVisible({ timeout: LONG });

      await expect(chartsPage.getFilterOptionByName('Rancher')).toBeAttached();
      await expect(chartsPage.getFilterOptionByName('RKE2')).toBeAttached();
      await expect(
        chartsPage.getAllOptionsByGroupName('Repository').filter({ hasText: 'Partners' }),
      ).not.toBeAttached();
    } finally {
      await appRepoList.goTo();
      await appRepoList.sortableTable().checkLoadingIndicatorNotVisible();
      const enableMenu = await appRepoList.list().actionMenu('Partners');

      await enableMenu.getMenuItem('Enable').click();

      await rancherApi.waitForResourceState('v1', 'catalog.cattle.io.clusterrepos', 'rancher-partner-charts');
    }
  });

  test('should display empty state properly', async ({ page, login }) => {
    await login();

    const chartsPage = new ChartsPage(page);

    await chartsPage.goTo();
    await chartsPage.waitForPage();
    await expect(chartsPage.chartCards().first()).toBeVisible({ timeout: LONG });

    // Type a non-existent search term to trigger empty state
    await chartsPage.chartsSearchFilterInput().fill('zzz-nonexistent-chart-e2e');

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
    await expect(chartsPage.chartCards().first()).toBeVisible({ timeout: LONG });

    const totalCharts = await chartsPage.totalChartsCount();

    for (let i = 0; i < 50; i++) {
      const currentCount = await chartsPage.chartCards().count();

      if (currentCount >= totalCharts) {
        break;
      }

      await chartsPage.scrollContainer().evaluate((el) => el.scrollTo(0, el.scrollHeight));
      // Poll until virtual-scroll renders new items after programmatic scroll
      try {
        await expect.poll(() => chartsPage.chartCards().count(), POLL_ITERATION_TIMEOUT).toBeGreaterThan(currentCount);
      } catch {
        // Scroll may not produce new items on every iteration — continue
      }
    }

    await expect(chartsPage.chartCards()).toHaveCount(totalCharts, SHORT_TIMEOUT_OPT);
  });
});

test.describe('Chart Details Page', { tag: ['@explorer', '@adminUser'] }, () => {
  const chartName = 'Logging';

  test('should navigate to the correct repository page', async ({ page, login, chartGuard }) => {
    await chartGuard('rancher-charts', 'rancher-logging');
    await login();

    const chartPage = new ChartPage(page);

    await chartPage.navTo(chartName);
    await chartPage.waitForPage();

    await chartPage.repoLink().click();
    await expect(page).toHaveURL(/\/c\/local\/apps\/catalog\.cattle\.io\.clusterrepo\/rancher-charts/);
  });

  test('should navigate to the charts list with the correct filters when a keyword is clicked', async ({
    page,
    login,
    chartGuard,
  }) => {
    await chartGuard('rancher-charts', 'rancher-logging');
    await login();

    const chartPage = new ChartPage(page);

    await chartPage.navTo(chartName);
    await chartPage.waitForPage();

    await chartPage.keywords().first().click();

    const chartsPage = new ChartsPage(page);

    await chartsPage.waitForPage();
    await expect(page).toHaveURL(/q=logging/);
  });

  test('should show more versions when the button is clicked', async ({ page, login, chartGuard }) => {
    await chartGuard('rancher-charts', 'rancher-logging');
    await login();

    const chartPage = new ChartPage(page);

    await chartPage.navTo(chartName);
    await chartPage.waitForPage();

    // Versions are truncated when the chart has many releases
    const showMoreBtn = chartPage.showMoreVersions();
    const versionLinks = chartPage.versionLinks();

    if (await showMoreBtn.isVisible()) {
      const initialCount = await versionLinks.count();

      await showMoreBtn.click();
      await expect(showMoreBtn).toContainText('Show Less');

      // After expanding, more versions should be visible
      const expandedCount = await versionLinks.count();

      expect(expandedCount).toBeGreaterThan(initialCount);
    } else {
      // Few versions — all shown without truncation
      await expect(versionLinks).not.toHaveCount(0);
    }
  });
});
