import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import { SMALL_CONTAINER } from '@/e2e/tests/pages/explorer2/workloads/workload.utils';

test.describe('CronJobs', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.describe('Details', () => {
    test('Jobs list updates automatically in CronJob details page', async ({ page, login, rancherApi }) => {
      test.setTimeout(120000);
      await login();
      const cronJobName = `e2e-cj-${Date.now()}`;
      const namespace = 'default';

      await rancherApi.createRancherResource('v1', 'batch.cronjobs', {
        apiVersion: 'batch/v1',
        kind: 'CronJob',
        metadata: { name: cronJobName, namespace },
        spec: {
          schedule: '1 1 1 1 1',
          concurrencyPolicy: 'Allow',
          failedJobsHistoryLimit: 1,
          successfulJobsHistoryLimit: 3,
          suspend: false,
          jobTemplate: {
            spec: {
              template: {
                spec: {
                  containers: [SMALL_CONTAINER],
                  restartPolicy: 'Never',
                },
              },
            },
          },
        },
      });

      try {
        const listPage = new PagePo(page, '/c/local/explorer/batch.cronjob');

        await listPage.goTo();
        await listPage.waitForPage();

        const sortableTable = new SortableTablePo(page, '.sortable-table');
        const actionMenu = await sortableTable.rowActionMenuOpen(cronJobName);

        const responsePromise = page.waitForResponse(
          (resp) => resp.url().includes(`v1/batch.jobs/${namespace}`) && resp.request().method() === 'POST',
        );

        await actionMenu.getMenuItem('Run Now').click();

        const response = await responsePromise;

        expect(response.status()).toBe(201);
      } finally {
        await rancherApi.deleteRancherResource('v1', 'batch.cronjobs', `${namespace}/${cronJobName}`, false);
      }
    });
  });
});
