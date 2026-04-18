import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import ResourceListMastheadPo from '@/e2e/po/components/resource-list-masthead.po';
import CreateEditViewPo from '@/e2e/po/components/create-edit-view.po';
import { WorkloadsCreatePageBasePo } from '@/e2e/po/pages/explorer/workloads/workloads.po';

test.describe('Jobs', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.describe('CRUD', () => {
    test('Creating a job while creating a new namespace should succeed', async ({ page, login, rancherApi }) => {
      await login();
      const namespaceName = `e2e-job-ns-${Date.now()}`;
      const jobName = `e2e-job-${Date.now()}`;

      try {
        const listPage = new PagePo(page, '/c/local/explorer/batch.job');

        await listPage.goTo();
        await listPage.waitForPage();

        const masthead = new ResourceListMastheadPo(page, ':scope');

        await masthead.create();

        const cruResource = new CreateEditViewPo(page, '.dashboard-root');
        const createPage = new WorkloadsCreatePageBasePo(page, 'local', 'batch.job');

        await createPage.namespaceDropdown().click();

        const createOption = page
          .locator('.vs__dropdown-menu .vs__dropdown-option')
          .filter({ hasText: 'Create a New Namespace' });

        await createOption.click();

        await createPage.namespaceInput().fill(namespaceName);

        await cruResource.nameNsDescription().name().set(jobName);
        await createPage.containerImage().set('nginx');

        const responsePromise = page.waitForResponse(
          (resp) => resp.url().includes('v1/batch.jobs') && resp.request().method() === 'POST',
        );

        await cruResource.formSave().click();

        const response = await responsePromise;

        expect(response.status()).toBe(201);

        await listPage.waitForPage();

        const sortableTable = new SortableTablePo(page, '.sortable-table');

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
              containers: [{ name: 'nginx', image: 'nginx:alpine' }],
              restartPolicy: 'Never',
            },
          },
        },
      });

      try {
        const listPage = new PagePo(page, '/c/local/explorer/batch.job');

        await listPage.goTo();
        await listPage.waitForPage();

        const sortableTable = new SortableTablePo(page, '.sortable-table');
        const actionMenu = await sortableTable.rowActionMenuOpen(jobName);

        await actionMenu.getMenuItem('Clone').click();

        const cruResource = new CreateEditViewPo(page, '.dashboard-root');

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
    test.skip(true, 'Pagination tests require bulk resource creation infrastructure (createManyNamespacedResources)');

    test('pagination is visible and user is able to navigate through jobs data', async () => {});
    test('sorting changes the order of paginated jobs data', async () => {});
    test('filter jobs', async () => {});
    test('pagination is hidden', async () => {});
  });
});
