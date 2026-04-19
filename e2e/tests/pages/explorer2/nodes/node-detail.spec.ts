import { test, expect } from '@/support/fixtures';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import { NodesListPagePo } from '@/e2e/po/pages/explorer/nodes.po';

test.describe('Node detail', { tag: ['@explorer2', '@adminUser'] }, () => {
  test('should still show the node detail view when the page is refreshed', async ({ page, login }) => {
    await login();
    const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

    await clusterDashboard.goTo();
    await clusterDashboard.waitForPage();
    await clusterDashboard.navToSideMenuEntryByLabel('Nodes');

    const nodesPage = new NodesListPagePo(page);

    await expect(nodesPage.masthead().title()).toContainText('Nodes');

    const sortableTable = nodesPage.sortableTable();

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
