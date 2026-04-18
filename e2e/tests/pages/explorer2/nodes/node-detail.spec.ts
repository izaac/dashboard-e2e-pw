import { test, expect } from '@/support/fixtures';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import ResourceListMastheadPo from '@/e2e/po/components/resource-list-masthead.po';

test.describe('Node detail', { tag: ['@explorer2', '@adminUser'] }, () => {
  test('should still show the node detail view when the page is refreshed', async ({ page, login }) => {
    await login();
    const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

    await clusterDashboard.goTo();
    await clusterDashboard.waitForPage();
    await clusterDashboard.navToSideMenuEntryByLabel('Nodes');

    const masthead = new ResourceListMastheadPo(page, ':scope');

    await expect(masthead.title()).toContainText('Nodes');

    const sortableTable = new SortableTablePo(page, '[data-testid="cluster-node-list"] .sortable-table');

    await sortableTable.checkVisible();

    const firstNodeLink = sortableTable.rowElementLink(0, 2);

    await expect(firstNodeLink).toBeVisible();
    const nodeName = (await firstNodeLink.textContent())?.trim();

    await firstNodeLink.click();

    await expect(page).toHaveURL(/\/explorer\/node\//);
    await expect(clusterDashboard.mastheadTitle()).toContainText(nodeName!, { timeout: 15000 });

    await page.reload();

    await expect(page).toHaveURL(/\/explorer\/node\//);
    await expect(clusterDashboard.mastheadTitle()).toContainText(nodeName!, { timeout: 15000 });
  });
});
