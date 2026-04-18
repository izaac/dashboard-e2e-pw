import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';

test.describe('Cluster Explorer', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.describe('Workloads', () => {
    test.describe('Replicasets', () => {
      test('should not be able to rollback a replicaset', async ({ page, login, rancherApi }) => {
        await login();
        const replicasetName = `e2e-rs-${Date.now()}`;
        const namespace = 'default';

        await rancherApi.createRancherResource('v1', 'apps.replicasets', {
          apiVersion: 'apps/v1',
          kind: 'ReplicaSet',
          metadata: { name: replicasetName, namespace },
          spec: {
            replicas: 1,
            selector: { matchLabels: { app: replicasetName } },
            template: {
              metadata: { labels: { app: replicasetName } },
              spec: { containers: [{ name: 'nginx', image: 'nginx:alpine' }] },
            },
          },
        });

        try {
          const listPage = new PagePo(page, '/c/local/explorer/apps.replicaset');

          await listPage.goTo();
          await listPage.waitForPage();

          const sortableTable = new SortableTablePo(page, '.sortable-table');

          await expect(sortableTable.rowElementWithPartialName(replicasetName)).toBeVisible();

          const actionMenu = await sortableTable.rowActionMenuOpen(replicasetName);

          await expect(actionMenu.self()).not.toContainText('Rollback');
        } finally {
          await rancherApi.deleteRancherResource('v1', 'apps.replicasets', `${namespace}/${replicasetName}`, false);
        }
      });
    });
  });
});
