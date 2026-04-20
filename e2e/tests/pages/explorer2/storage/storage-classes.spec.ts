import { test, expect } from '@/support/fixtures';
import { StorageClassesPagePo } from '@/e2e/po/pages/explorer/storage-classes.po';

test.describe('StorageClasses', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@noVai', '@adminUser'] }, () => {
    test('validate storage classes table headers', async ({ page, login }) => {
      await login();
      const storageClassesPage = new StorageClassesPagePo(page);

      await storageClassesPage.goTo();
      await storageClassesPage.waitForPage();

      const sortableTable = storageClassesPage.list().resourceTable().sortableTable();

      await sortableTable.checkVisible();

      const expectedHeaders = ['State', 'Name', 'Provisioner', 'Default', 'Age'];
      const headerNames = await sortableTable.headerNames();

      expect(headerNames).toEqual(expectedHeaders);
    });

    test('validate storage classes table is visible', async ({ page, login }) => {
      await login();
      const storageClassesPage = new StorageClassesPagePo(page);

      await storageClassesPage.goTo();
      await storageClassesPage.waitForPage();

      const sortableTable = storageClassesPage.list().resourceTable().sortableTable();

      await sortableTable.checkVisible();
    });

    test('can open Edit as YAML from create page', async ({ page, login }) => {
      await login();
      const storageClassesPage = new StorageClassesPagePo(page);

      await storageClassesPage.goTo();
      await storageClassesPage.waitForPage();

      await storageClassesPage.clickCreate();

      const cruResource = storageClassesPage.list().createEditView();

      await cruResource.editAsYaml();
      await expect(cruResource.yamlEditor()).toBeVisible();
    });
  });
});
