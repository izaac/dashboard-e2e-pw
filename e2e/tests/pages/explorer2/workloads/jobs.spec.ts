import { test, expect } from '@/support/fixtures';
import { WorkloadsJobsListPagePo, WorkLoadsJobDetailsPagePo } from '@/e2e/po/pages/explorer/workloads-jobs.po';
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

test.describe('Jobs', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.describe('CRUD', () => {
    test('Creating a job while creating a new namespace should succeed', async ({ page, login, rancherApi }) => {
      await login();
      const namespaceName = `e2e-job-ns-${Date.now()}`;
      const jobName = `e2e-job-${Date.now()}`;

      try {
        const listPage = new WorkloadsJobsListPagePo(page);

        await listPage.goTo();
        await listPage.waitForPage();

        await listPage.baseResourceList().masthead().create();

        const detailPage = new WorkLoadsJobDetailsPagePo(page, jobName);
        const cruResource = detailPage.resourceDetail().createEditView();

        await detailPage.selectNamespace('Create a New Namespace');
        await detailPage.namespaceInput().fill(namespaceName);

        await cruResource.nameNsDescription().name().set(jobName);
        await detailPage.containerImage().set('nginx');

        const responsePromise = page.waitForResponse(
          (resp) => resp.url().includes('v1/batch.jobs') && resp.request().method() === 'POST',
        );

        await cruResource.formSave().click();

        const response = await responsePromise;

        expect(response.status()).toBe(201);

        await listPage.waitForPage();

        const sortableTable = listPage.baseResourceList().resourceTable().sortableTable();

        await expect(sortableTable.rowElementWithPartialName(jobName)).toBeVisible();
      } finally {
        await rancherApi.deleteRancherResource('v1', 'namespaces', namespaceName, false);
      }
    });

    test('Should be able to clone a job', async ({ page, login, rancherApi }) => {
      await login();
      const namespace = `e2e-clone-job-ns-${Date.now()}`;
      const jobName = `e2e-job-clone-${Date.now()}`;
      const cloneName = `${jobName}-copy`;

      await rancherApi.createNamespace(namespace);

      try {
        await rancherApi.createRancherResource('v1', 'batch.jobs', {
          apiVersion: 'batch/v1',
          kind: 'Job',
          metadata: { name: jobName, namespace },
          spec: {
            backoffLimit: 6,
            completions: 1,
            parallelism: 1,
            template: {
              metadata: { labels: { 'job-name': jobName } },
              spec: {
                containers: [SMALL_CONTAINER],
                restartPolicy: 'Never',
              },
            },
          },
        });

        const listPage = new WorkloadsJobsListPagePo(page);

        await listPage.goTo();
        await listPage.waitForPage();

        const sortableTable = listPage.baseResourceList().resourceTable().sortableTable();
        const actionMenu = await sortableTable.rowActionMenuOpen(jobName);

        await actionMenu.getMenuItem('Clone').click();

        const clonePage = new WorkLoadsJobDetailsPagePo(page, jobName, 'local', namespace);
        const cruResource = clonePage.resourceDetail().createEditView();

        await cruResource.nameNsDescription().name().set(cloneName);
        await cruResource.formSave().click();

        await listPage.waitForPage();
        await expect(sortableTable.rowElementWithPartialName(cloneName)).toBeVisible();
      } finally {
        await rancherApi.deleteRancherResource('v1', 'namespaces', namespace, false);
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
      ns1 = `e2e-job-list-${Date.now()}`;
      ns2 = `e2e-job-unique-${Date.now()}`;

      await Promise.all([rancherApi.createNamespace(ns1), rancherApi.createNamespace(ns2)]);

      uniqueName = `e2e-unique-${Date.now()}`;

      const [names] = await Promise.all([
        createBulkResources(rancherApi, 'v1', 'batch.jobs', ns1, 22, (ns: string, name: string) => ({
          apiVersion: 'batch/v1',
          kind: 'Job',
          metadata: { name, namespace: ns },
          spec: {
            template: {
              spec: {
                containers: [{ name: 'test', image: SMALL_CONTAINER.image, command: ['sh', '-c', 'exit 0'] }],
                restartPolicy: 'Never',
              },
            },
            backoffLimit: 0,
          },
        })),
        rancherApi.createRancherResource('v1', 'batch.jobs', {
          apiVersion: 'batch/v1',
          kind: 'Job',
          metadata: { name: uniqueName, namespace: ns2 },
          spec: {
            template: {
              spec: {
                containers: [{ name: 'test', image: SMALL_CONTAINER.image, command: ['sh', '-c', 'exit 0'] }],
                restartPolicy: 'Never',
              },
            },
            backoffLimit: 0,
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

    // eslint-disable-next-line playwright/expect-expect -- assertion via assertPaginationNavigation()
    test('pagination is visible and user is able to navigate through jobs data', async ({ page, login }) => {
      await login();
      const listPage = new WorkloadsJobsListPagePo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      const table = listPage.baseResourceList().resourceTable().sortableTable();

      await assertPaginationNavigation(table, 23);
    });

    // eslint-disable-next-line playwright/expect-expect -- assertion via assertPaginationSorting()
    test('sorting changes the order of paginated jobs data', async ({ page, login }) => {
      await login();
      const listPage = new WorkloadsJobsListPagePo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      const table = listPage.baseResourceList().resourceTable().sortableTable();

      await assertPaginationSorting(table, bulkNames[0], 'e2e-');
    });

    // eslint-disable-next-line playwright/expect-expect -- assertion via assertPaginationFilter()
    test('filter jobs', async ({ page, login }) => {
      await login();
      const listPage = new WorkloadsJobsListPagePo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      const table = listPage.baseResourceList().resourceTable().sortableTable();

      await assertPaginationFilter(table, bulkNames[0], uniqueName, ns2);
    });

    // eslint-disable-next-line playwright/expect-expect -- assertion via assertPaginationHidden()
    test('pagination is hidden', async ({ page, login }) => {
      await login();

      await mockSmallCollection(page, 'v1/batch.jobs', 'batch.job');

      const listPage = new WorkloadsJobsListPagePo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      const table = listPage.baseResourceList().resourceTable().sortableTable();

      await assertPaginationHidden(table);

      await page.unroute('**/v1/batch.jobs?**');
    });
  });
});
