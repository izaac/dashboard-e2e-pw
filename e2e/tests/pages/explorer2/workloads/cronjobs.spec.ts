import { test, expect } from '@/support/fixtures';
import { WorkloadsCronJobsListPagePo } from '@/e2e/po/pages/explorer/workloads-cronjobs.po';
import { SMALL_CONTAINER } from '@/e2e/tests/pages/explorer2/workloads/workload.utils';
import {
  createBulkResources,
  setTablePreferences,
  restoreTablePreferences,
  assertPaginationNavigation,
  assertPaginationSorting,
  assertPaginationFilter,
  assertPaginationHidden,
  mockSmallCollection,
  type SavedPrefs,
} from './pagination.utils';

test.describe('CronJobs', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.describe('Details', () => {
    test('Jobs list updates automatically in CronJob details page', async ({ page, login, rancherApi }) => {
      test.setTimeout(120000);
      await login();
      const cronJobName = `e2e-cj-${Date.now()}`;
      const namespace = 'default';

      try {
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

        const listPage = new WorkloadsCronJobsListPagePo(page);

        await listPage.goTo();
        await listPage.waitForPage();

        const sortableTable = listPage.baseResourceList().resourceTable().sortableTable();
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

  test.describe('List', { tag: ['@noVai', '@adminUser'] }, () => {
    test.describe.configure({ mode: 'serial' });
    // Serial: tests share bulk resource setup (22 resources + user prefs)

    let savedPrefs: SavedPrefs;
    let ns1: string;
    let ns2: string;
    let bulkNames: string[];
    let uniqueName: string;

    test.beforeAll(async ({ rancherApi }) => {
      ns1 = `e2e-cj-list-${Date.now()}`;
      ns2 = `e2e-cj-unique-${Date.now()}`;

      await Promise.all([
        rancherApi.createNamespace(ns1),
        rancherApi.createNamespace(ns2),
      ]);

      uniqueName = `e2e-unique-${Date.now()}`;

      const [names] = await Promise.all([
        createBulkResources(rancherApi, 'v1', 'batch.cronjobs', ns1, 22, (ns: string, name: string) => ({
          apiVersion: 'batch/v1',
          kind: 'CronJob',
          metadata: { name, namespace: ns },
          spec: {
            schedule: '0 0 31 2 *',
            suspend: true,
            jobTemplate: {
              spec: {
                template: {
                  spec: {
                    containers: [SMALL_CONTAINER],
                    restartPolicy: 'OnFailure',
                  },
                },
              },
            },
          },
        })),
        rancherApi.createRancherResource('v1', 'batch.cronjobs', {
          apiVersion: 'batch/v1',
          kind: 'CronJob',
          metadata: { name: uniqueName, namespace: ns2 },
          spec: {
            schedule: '0 0 31 2 *',
            suspend: true,
            jobTemplate: {
              spec: {
                template: {
                  spec: {
                    containers: [SMALL_CONTAINER],
                    restartPolicy: 'OnFailure',
                  },
                },
              },
            },
          },
        }),
      ]);

      bulkNames = names;
      savedPrefs = await setTablePreferences(rancherApi, [ns1, ns2]);
    });

    test.afterAll(async ({ rancherApi }) => {
      await restoreTablePreferences(rancherApi, savedPrefs);
      await rancherApi.deleteRancherResource('v1', 'namespaces', ns1, false);
      await rancherApi.deleteRancherResource('v1', 'namespaces', ns2, false);
    });

    test('pagination is visible and user is able to navigate through cronjobs data', async ({ page, login }) => {
      await login();
      const listPage = new WorkloadsCronJobsListPagePo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      const table = listPage.baseResourceList().resourceTable().sortableTable();

      await assertPaginationNavigation(table, 23);
    });

    test('sorting changes the order of paginated cronjobs data', async ({ page, login }) => {
      await login();
      const listPage = new WorkloadsCronJobsListPagePo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      const table = listPage.baseResourceList().resourceTable().sortableTable();

      await assertPaginationSorting(table, bulkNames[0], 'e2e-');
    });

    test('filter cronjobs', async ({ page, login }) => {
      await login();
      const listPage = new WorkloadsCronJobsListPagePo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      const table = listPage.baseResourceList().resourceTable().sortableTable();

      await assertPaginationFilter(table, bulkNames[0], uniqueName, ns2);
    });

    test('pagination is hidden', async ({ page, login }) => {
      await login();

      await mockSmallCollection(page, 'v1/batch.cronjobs', 'batch.cronjob');

      const listPage = new WorkloadsCronJobsListPagePo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      const table = listPage.baseResourceList().resourceTable().sortableTable();

      await assertPaginationHidden(table);

      await page.unroute('**/v1/batch.cronjobs?**');
    });
  });
});
