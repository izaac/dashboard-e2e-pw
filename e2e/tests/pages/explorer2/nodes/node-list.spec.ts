import { test, expect } from '@/support/fixtures';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import { dummyNode } from '@/e2e/blueprints/explorer2/nodes';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import ResourceListMastheadPo from '@/e2e/po/components/resource-list-masthead.po';

test.describe('Nodes list', { tag: ['@explorer2', '@adminUser'] }, () => {
  test('should show the nodes list page with dummy node', async ({ page, login, rancherApi }) => {
    const nodeName = `e2e-node-${Date.now()}`;
    const nodePayload = { ...dummyNode, metadata: { ...dummyNode.metadata, name: nodeName } };

    await rancherApi.createRancherResource('v1', 'nodes', nodePayload, false);

    try {
      await login();
      const nodesResp = await rancherApi.getRancherResource('v1', 'nodes');
      const nodeCount = nodesResp.body.count;

      const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

      await clusterDashboard.goTo();
      await clusterDashboard.waitForPage();
      await clusterDashboard.navToSideMenuEntryByLabel('Nodes');

      const masthead = new ResourceListMastheadPo(page, ':scope');

      await expect(masthead.title()).toContainText('Nodes');

      const sortableTable = new SortableTablePo(page, '[data-testid="cluster-node-list"] .sortable-table');

      await sortableTable.checkVisible();
      await expect(sortableTable.rowElements()).toHaveCount(nodeCount);
      await expect(sortableTable.self()).toContainText(nodeName);

      await sortableTable.rowElementLink(0, 2).click();
      await expect(clusterDashboard.mastheadTitle()).toContainText('Node:');
    } finally {
      await rancherApi.deleteRancherResource('v1', 'nodes', nodeName, false);
    }
  });
});
