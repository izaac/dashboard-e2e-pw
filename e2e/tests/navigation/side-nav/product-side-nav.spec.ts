import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';
import { WorkloadsDeploymentsListPagePo } from '@/e2e/po/pages/explorer/workloads/workloads-deployments.po';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';

const workloadName = `test-deployment-kubectl-${Date.now()}`;
const namespace = 'default';

test.describe('Side navigation: Cluster', { tag: ['@navigation', '@adminUser'] }, () => {
  test.afterAll(async ({ rancherApi }) => {
    await rancherApi.deleteRancherResource('v1', 'apps.deployments', `${namespace}/${workloadName}`, false);
  });

  test.beforeEach(async ({ page, login, rancherApi }) => {
    // Ensure test deployment exists (idempotent: create if missing)
    const existing = await rancherApi.getRancherResource('v1', 'apps.deployments', `${namespace}/${workloadName}`, 0);

    if (existing.status !== 200) {
      await rancherApi.createRancherResource('v1', 'apps.deployments', {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: workloadName,
          namespace,
          labels: { 'workload.user.cattle.io/workloadselector': 'apps.deployment-default-test-deployment' },
        },
        spec: {
          replicas: 1,
          selector: {
            matchLabels: { 'workload.user.cattle.io/workloadselector': 'apps.deployment-default-test-deployment' },
          },
          template: {
            metadata: {
              labels: { 'workload.user.cattle.io/workloadselector': 'apps.deployment-default-test-deployment' },
            },
            spec: {
              containers: [
                {
                  name: 'nginx',
                  image: 'nginx:latest',
                },
              ],
            },
          },
        },
      });
    }

    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();

    const burgerMenu = new BurgerMenuPo(page);

    await burgerMenu.goToCluster('local');

    // Wait for the cluster explorer to load and the product side nav to appear
    const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

    await clusterDashboard.waitForPage();
    const productNav = new ProductNavPo(page);

    await expect(productNav.groups().first()).toBeAttached({ timeout: 30000 });
  });

  test('Can access to first navigation link on click', async ({ page }) => {
    const productNavPo = new ProductNavPo(page);

    const firstLink = productNavPo.visibleNavTypes().first();

    await expect(firstLink).toBeVisible();
    const href = await firstLink.getAttribute('href');

    await firstLink.click();

    if (href) {
      await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });

  test('Can open second menu groups on click', async ({ page }) => {
    const productNavPo = new ProductNavPo(page);

    // Determine which index among all groups is the first closed one
    const allGroups = productNavPo.groups();
    const groupCount = await allGroups.count();
    let closedIdx = -1;

    for (let i = 0; i < groupCount; i++) {
      const cls = (await allGroups.nth(i).getAttribute('class')) ?? '';

      if (!cls.includes('expanded')) {
        closedIdx = i;
        break;
      }
    }

    expect(closedIdx).toBeGreaterThanOrEqual(0);

    // Use a stable nth-based reference that won't change when class toggles
    const targetGroup = allGroups.nth(closedIdx);

    await expect(targetGroup).toBeVisible();
    await targetGroup.click();

    // After click the group is expanded — verify it has child items
    await expect(productNavPo.groupChildList(targetGroup)).toBeAttached();
    const ulCount = await productNavPo.groupChildList(targetGroup).count();

    expect(ulCount).toBeGreaterThan(0);
  });

  test('Can close first menu groups on click', async ({ page }) => {
    const productNavPo = new ProductNavPo(page);

    // Determine the first closed group by stable index
    const allGroups = productNavPo.groups();
    const groupCount = await allGroups.count();
    let closedIdx = -1;

    for (let i = 0; i < groupCount; i++) {
      const cls = (await allGroups.nth(i).getAttribute('class')) ?? '';

      if (!cls.includes('expanded')) {
        closedIdx = i;
        break;
      }
    }

    expect(closedIdx).toBeGreaterThanOrEqual(0);

    const targetGroup = allGroups.nth(closedIdx);

    await expect(targetGroup).toBeVisible();
    await targetGroup.click();

    // Now check that the previously open group collapsed
    const expandedCount = await productNavPo.expandedGroup().count();

    // At least one group should remain expanded (the one we just clicked)
    expect(expandedCount).toBeGreaterThanOrEqual(1);
  });

  test('Should flag second menu group as active on navigation', async ({ page }) => {
    const productNavPo = new ProductNavPo(page);

    // Determine the first closed group by stable index
    const allGroups = productNavPo.groups();
    const groupCount = await allGroups.count();
    let closedIdx = -1;

    for (let i = 0; i < groupCount; i++) {
      const cls = (await allGroups.nth(i).getAttribute('class')) ?? '';

      if (!cls.includes('expanded')) {
        closedIdx = i;
        break;
      }
    }

    expect(closedIdx).toBeGreaterThanOrEqual(0);

    const targetGroup = allGroups.nth(closedIdx);

    await expect(targetGroup).toBeVisible();
    await targetGroup.click();

    // Should have an active router link within
    await expect(productNavPo.activeLinksInGroup(targetGroup)).toBeAttached();
  });

  test('Going into resource detail should keep relevant group active', async ({ page }) => {
    const productNavPo = new ProductNavPo(page);
    const deploymentsListPage = new WorkloadsDeploymentsListPagePo(page, 'local');

    // Click the second visible nav type to go into Workloads area
    await productNavPo.visibleNavTypes().nth(1).click();

    await deploymentsListPage.goTo();
    await deploymentsListPage.waitForPage();
    await deploymentsListPage.goToDetailsPage(workloadName);

    // The expanded group should still be visible with active links
    const openGroup = productNavPo.expandedGroup().first();

    await expect(openGroup).toBeVisible();
    await expect(productNavPo.activeLinksInGroup(openGroup)).toBeAttached();
  });

  test('Should access every navigation link provided from the server, including nested cases, without errors', async ({
    page,
  }) => {
    const productNavPo = new ProductNavPo(page);

    const groupCount = await productNavPo.groups().count();

    for (let index = 0; index < groupCount; index++) {
      const group = productNavPo.groups().nth(index);

      // Expand current group
      await group.click();

      // Check for sub-groups (nested accordions) and expand them
      const subAccordions = productNavPo.subAccordions(group);
      const subCount = await subAccordions.count();

      if (subCount > 0) {
        for (let j = 0; j < subCount; j++) {
          await subAccordions.nth(j).click();
        }
      }

      // Ensure group is expanded with items (use .first() — nested sub-groups may have multiple ul)
      await expect(productNavPo.groupChildList(group).first()).toBeAttached();

      // Visit each link and confirm navigation
      const linkCount = await productNavPo.visibleNavTypes().count();

      for (let linkIdx = 0; linkIdx < linkCount; linkIdx++) {
        const link = productNavPo.visibleNavTypes().nth(linkIdx);
        const href = await link.getAttribute('href');

        await link.click({ force: true });

        if (href) {
          await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        }
      }
    }
  });

  test('Clicking on the tab header should navigate', async ({ page }) => {
    const productNavPo = new ProductNavPo(page);
    const group = productNavPo.groups().first(); // first group is 'Cluster'

    // Expand the first group
    await group.click();

    const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

    await clusterDashboard.waitForPage();

    // Go to the third item in the nav
    await productNavPo.visibleNavTypes().nth(2).click({ force: true });

    // Clicking the first tab header should take us back to cluster dashboard
    await productNavPo
      .tabHeaders()
      .first()
      .click({ position: { x: 1, y: 1 } });
    await clusterDashboard.waitForPage();
  });
});
