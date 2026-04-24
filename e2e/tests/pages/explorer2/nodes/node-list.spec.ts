import { test, expect } from '@/support/fixtures';
import { NodesPagePo } from '@/e2e/po/pages/explorer/nodes.po';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import { dummyNode } from '@/e2e/blueprints/explorer2/nodes';

test.describe('Nodes list', { tag: ['@explorer2', '@adminUser'] }, () => {
  test('should show the nodes list page with dummy node', async ({ page, login, rancherApi }) => {
    const nodeName = `e2e-node-${Date.now()}`;
    const nodePayload = { ...dummyNode, metadata: { ...dummyNode.metadata, name: nodeName } };

    await rancherApi.createRancherResource('v1', 'nodes', nodePayload, false);

    try {
      await login();
      const nodesResp = await rancherApi.getRancherResource('v1', 'nodes');
      const nodeCount = nodesResp.body.count;

      const nodesPage = new NodesPagePo(page);

      await nodesPage.goTo();
      await nodesPage.waitForPage();

      const masthead = nodesPage.list().masthead();

      await expect(masthead.title()).toContainText('Nodes');

      const sortableTable = nodesPage.list().resourceTable().sortableTable();

      await expect(sortableTable.self()).toBeVisible();
      await expect(sortableTable.rowElements()).toHaveCount(nodeCount);
      await expect(sortableTable.self()).toContainText(nodeName);

      const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

      await sortableTable.rowElementLink(0, 2).click();
      await expect(clusterDashboard.mastheadTitle()).toContainText('Node:');
    } finally {
      await rancherApi.deleteRancherResource('v1', 'nodes', nodeName, false);
    }
  });
});
