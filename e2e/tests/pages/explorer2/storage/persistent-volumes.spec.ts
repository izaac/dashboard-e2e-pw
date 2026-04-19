import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import ResourceListMastheadPo from '@/e2e/po/components/resource-list-masthead.po';
import CreateEditViewPo from '@/e2e/po/components/create-edit-view.po';

test.describe('PersistentVolumes', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@noVai', '@adminUser'] }, () => {
    test('validate persistent volumes table headers', async ({ page, login }) => {
      await login();
      const pvPage = new PagePo(page, '/c/local/explorer/persistentvolume');

      await pvPage.goTo();
      await pvPage.waitForPage();

      const sortableTable = new SortableTablePo(page, '.sortable-table');

      await sortableTable.checkVisible();
      const expectedHeaders = ['State', 'Name', 'Reclaim Policy', 'Persistent Volume Claim', 'Source', 'Reason', 'Age'];
      const headerNames = await sortableTable.headerNames();

      expect(headerNames).toEqual(expectedHeaders);
    });

    test('can open create page', async ({ page, login }) => {
      await login();
      const pvPage = new PagePo(page, '/c/local/explorer/persistentvolume');

      await pvPage.goTo();
      await pvPage.waitForPage();

      const masthead = new ResourceListMastheadPo(page, ':scope');

      await masthead.create();
      await expect(page).toHaveURL(/\/persistentvolume\/create/);
    });

    test('can open Edit as YAML', async ({ page, login }) => {
      await login();
      const pvPage = new PagePo(page, '/c/local/explorer/persistentvolume');

      await pvPage.goTo();
      await pvPage.waitForPage();

      const masthead = new ResourceListMastheadPo(page, ':scope');

      await masthead.create();

      const cruResource = new CreateEditViewPo(page, '.dashboard-root');

      await cruResource.editAsYaml();
      await expect(pvPage.yamlEditor()).toBeVisible();
    });
  });
});
