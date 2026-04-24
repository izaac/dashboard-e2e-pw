import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';
import { ChartsPage } from '@/e2e/po/pages/explorer/charts/charts.po';
import { ChartPage } from '@/e2e/po/pages/explorer/charts/chart.po';
import UsersPo from '@/e2e/po/pages/users-and-auth/users.po';
import RolesPo from '@/e2e/po/pages/users-and-auth/roles.po';
import ClusterProjectMembersPo from '@/e2e/po/pages/explorer/cluster-project-members.po';

const BLANK_CLUSTER = '_';

test.describe('Side navigation: Highlighting', { tag: ['@navigation', '@adminUser'] }, () => {
  const CHART = {
    name: 'Alerting Drivers',
    id: 'rancher-alerting-drivers',
    repo: 'rancher-charts',
  };

  test.beforeEach(async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();
  });

  test('Cluster and Project members is highlighted correctly', async ({ page }) => {
    const homePage = new HomePagePo(page);

    await homePage.goTo();

    const productNavPo = new ProductNavPo(page);
    const clusterMembership = new ClusterProjectMembersPo(page, 'local', 'cluster-membership');

    await clusterMembership.navToClusterMenuEntry('local');
    // Wait for the cluster page to load to avoid stale side nav
    await clusterMembership.waitForPageWithSpecificUrl('/c/local/explorer');
    await clusterMembership.navToSideMenuEntryByLabel('Cluster and Project Members');
    await clusterMembership.waitForPage();

    const activeItem = await productNavPo.activeNavItem();

    expect(activeItem).toBe('Cluster and Project Members');
  });

  test('Chart and sub-pages are highlighted correctly', async ({ page }) => {
    const homePage = new HomePagePo(page);

    await homePage.goTo();

    const chartsPage = new ChartsPage(page);

    await chartsPage.goTo();
    await chartsPage.waitForPage();

    const productNavPo = new ProductNavPo(page);

    // Click the first visible nav type and verify URL matches
    const firstLink = productNavPo.visibleNavTypes().first();

    await expect(firstLink).toBeVisible();
    const href = await firstLink.getAttribute('href');

    await firstLink.click();

    if (href) {
      // eslint-disable-next-line playwright/no-conditional-expect -- href may be null for JS-driven nav links
      await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    const activeAfterClick = await productNavPo.activeNavItem();

    expect(activeAfterClick).toBe('Charts');

    // Wait for charts page to load
    await expect(chartsPage.chartCards().first()).toBeVisible();

    // Search for the chart
    await chartsPage.chartsSearchFilterInput().fill(CHART.name);
    await expect(chartsPage.chartsSearchFilterInput()).toHaveValue(CHART.name);

    // Ensure the specific chart exists
    await expect(chartsPage.getChartByName(CHART.name)).toBeVisible();

    // Go to the chart detail page
    await chartsPage.clickChart(CHART.name);

    const chartPage = new ChartPage(page);

    // Wait for navigation to the chart page
    await chartPage.waitForPageWithSpecificUrl(undefined, `repo-type=cluster&repo=${CHART.repo}&chart=${CHART.id}`);

    const activeOnChart = await productNavPo.activeNavItem();

    expect(activeOnChart).toBe('Charts');

    // Go to install
    await chartPage.goToInstall();

    const activeOnInstall = await productNavPo.activeNavItem();

    expect(activeOnInstall).toBe('Charts');
  });

  test('User Retention highlighting', async ({ page }) => {
    const usersPo = new UsersPo(page);
    const productNavPo = new ProductNavPo(page);

    await usersPo.goTo();
    await usersPo.waitForPage();

    const activeOnUsers = await productNavPo.activeNavItem();

    expect(activeOnUsers).toBe('Users');

    await usersPo.userRetentionLink().click();

    const activeAfterRetention = await productNavPo.activeNavItem();

    expect(activeAfterRetention).toBe('Users');
  });

  test('Roles Template checks handling of hash in URL', async ({ page }) => {
    const productNavPo = new ProductNavPo(page);
    const roles = new RolesPo(page, BLANK_CLUSTER);
    const GLOBAL = 'GLOBAL';
    const CLUSTER = 'CLUSTER';

    await roles.goTo(undefined, GLOBAL);
    await roles.waitForPage(undefined, GLOBAL);
    await expect(roles.list(GLOBAL).rowWithName('Administrator').self()).toBeAttached();

    const activeOnGlobal = await productNavPo.activeNavItem();

    expect(activeOnGlobal).toBe('Role Templates');

    await roles.tabs().clickTabWithName(CLUSTER);
    await expect(roles.list(CLUSTER).rowWithName('Cluster Owner').self()).toBeAttached();

    const activeOnCluster = await productNavPo.activeNavItem();

    expect(activeOnCluster).toBe('Role Templates');
  });
});
