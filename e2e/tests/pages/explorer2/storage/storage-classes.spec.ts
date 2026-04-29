import { test, expect } from '@/support/fixtures';
import { StorageClassesPagePo } from '@/e2e/po/pages/explorer/storage-classes.po';

test.describe('StorageClasses', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@noVai', '@adminUser'] }, () => {
    test('validate storage classes table in empty state', async ({ page, login }) => {
      await page.route('**/v1/storage.k8s.io.storageclasses?*', (route) =>
        route.fulfill({
          json: { type: 'collection', resourceType: 'storage.k8s.io.storageclass', count: 0, data: [] },
        }),
      );
      await login();
      const storageClassesPage = new StorageClassesPagePo(page);

      await storageClassesPage.goTo();
      await storageClassesPage.waitForPage();

      const sortableTable = storageClassesPage.list().resourceTable().sortableTable();

      await expect(sortableTable.self()).toBeVisible();

      const expectedHeaders = ['State', 'Name', 'Provisioner', 'Default', 'Age'];
      const headerNames = await sortableTable.headerNames();

      expect(headerNames).toEqual(expectedHeaders);
      await expect(sortableTable.noRowsText()).toBeVisible();
    });

    test('validate storage classes table headers', async ({ page, login }) => {
      await login();
      const storageClassesPage = new StorageClassesPagePo(page);

      await storageClassesPage.goTo();
      await storageClassesPage.waitForPage();

      const sortableTable = storageClassesPage.list().resourceTable().sortableTable();

      await expect(sortableTable.self()).toBeVisible();

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

      await expect(sortableTable.self()).toBeVisible();
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
