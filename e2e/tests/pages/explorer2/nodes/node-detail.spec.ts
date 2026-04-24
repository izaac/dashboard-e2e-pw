import { test, expect } from '@/support/fixtures';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import { NodesPagePo } from '@/e2e/po/pages/explorer/nodes.po';
import { SHORT_TIMEOUT_OPT } from '@/support/utils/timeouts';

test.describe('Node detail', { tag: ['@explorer2', '@adminUser'] }, () => {
  test('should still show the node detail view when the page is refreshed', async ({ page, login }) => {
    await login();
    const nodesPage = new NodesPagePo(page);

    await nodesPage.goTo();
    await nodesPage.waitForPage();

    const masthead = nodesPage.list().masthead();

    await expect(masthead.title()).toContainText('Nodes');

    const sortableTable = nodesPage.list().resourceTable().sortableTable();

    await expect(sortableTable.self()).toBeVisible();

    const firstNodeLink = sortableTable.rowElementLink(0, 2);

    await expect(firstNodeLink).toBeVisible();
    await expect(firstNodeLink).not.toHaveText('');
    const nodeName = (await firstNodeLink.textContent())?.trim();

    await firstNodeLink.click();

    const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

    await expect(page).toHaveURL(/\/explorer\/node\//);
    await expect(clusterDashboard.mastheadTitle()).toContainText(nodeName!, SHORT_TIMEOUT_OPT);

    await page.reload();

    await expect(page).toHaveURL(/\/explorer\/node\//);
    await expect(clusterDashboard.mastheadTitle()).toContainText(nodeName!, SHORT_TIMEOUT_OPT);
  });
});
