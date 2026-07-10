import { test, expect } from '@/support/fixtures';
import WorkloadDashboardPagePo from '@/e2e/po/pages/explorer/workloads/workload-dashboard.po';

test.describe('Workload Dashboard', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.beforeEach(async ({ page, login, rancherApi }) => {
    await login();
    await rancherApi.updateNamespaceFilter('local', 'none', '{"local":[]}');

    await WorkloadDashboardPagePo.navTo(page, 'local');
    const workloadDashboard = new WorkloadDashboardPagePo(page);

    await workloadDashboard.waitForPage();
  });

  test.afterEach(async ({ rancherApi }) => {
    await rancherApi.updateNamespaceFilter('local', 'none', '{"local":["all://user"]}');
  });

  test('should display the title', async ({ page }) => {
    const workloadDashboard = new WorkloadDashboardPagePo(page);

    await expect(workloadDashboard.title()).toContainText('Workloads Overview');
  });

  test('should display a namespace subtitle with workload count', async ({ page }) => {
    const workloadDashboard = new WorkloadDashboardPagePo(page);

    await expect(workloadDashboard.subtitle()).toBeVisible();
    await expect(workloadDashboard.subtitle()).toContainText(/\(\d+ workloads?\)/);
  });

  test('should display the By State section with state cards', async ({ page }) => {
    const workloadDashboard = new WorkloadDashboardPagePo(page);

    await expect(workloadDashboard.byStateSection()).toBeVisible();
    const count = await workloadDashboard.stateCards().count();

    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should display the By Type section with type cards', async ({ page }) => {
    const workloadDashboard = new WorkloadDashboardPagePo(page);

    await expect(workloadDashboard.byTypeSection()).toBeVisible();
    const count = await workloadDashboard.byTypeCards().count();

    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should navigate to the resource list when clicking a By Type card', async ({ page }) => {
    const workloadDashboard = new WorkloadDashboardPagePo(page);

    await workloadDashboard.byTypeCards().first().click();

    await expect(page).toHaveURL(/\/c\/local\/explorer\/(apps\.|batch\.)?[a-z]+/);
  });

  test('should show empty state when namespace filter matches no workloads', async ({ page, login }) => {
    // Intercept the summary requests the workload dashboard makes for each
    // resource type. The URL includes multiple query params before &summary=,
    // so match on the distinctive &summaryonly param.
    await page.route(/summaryonly/, async (route) => {
      await route.fulfill({ json: { summary: [], count: 0, data: [] } });
    });

    await login();

    const workloadDashboard = new WorkloadDashboardPagePo(page);

    await workloadDashboard.goTo();
    await workloadDashboard.waitForPage();

    await expect(workloadDashboard.emptyState()).toBeVisible();
  });
});
