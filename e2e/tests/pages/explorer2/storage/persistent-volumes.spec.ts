import { test, expect } from '@/support/fixtures';
import { PersistentVolumesPagePo } from '@/e2e/po/pages/explorer/persistent-volumes.po';

test.describe('PersistentVolumes', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@noVai', '@adminUser'] }, () => {
    test('validate persistent volumes table in empty state', async ({ page, login }) => {
      await page.route('**/v1/persistentvolumes?*', (route) =>
        route.fulfill({
          json: { type: 'collection', resourceType: 'persistentvolume', count: 0, data: [] },
        }),
      );
      await login();
      const pvPage = new PersistentVolumesPagePo(page);

      await pvPage.goTo();
      await pvPage.waitForPage();

      const sortableTable = pvPage.list().resourceTable().sortableTable();

      await expect(sortableTable.self()).toBeVisible();

      const expectedHeaders = ['State', 'Name', 'Reclaim Policy', 'Persistent Volume Claim', 'Source', 'Reason', 'Age'];
      const headerNames = await sortableTable.headerNames();

      expect(headerNames).toEqual(expectedHeaders);
      await expect(sortableTable.noRowsText()).toBeVisible();
    });

    test('validate persistent volumes table headers', async ({ page, login }) => {
      await login();
      const pvPage = new PersistentVolumesPagePo(page);

      await pvPage.goTo();
      await pvPage.waitForPage();

      const sortableTable = pvPage.list().resourceTable().sortableTable();

      await expect(sortableTable.self()).toBeVisible();

      const expectedHeaders = ['State', 'Name', 'Reclaim Policy', 'Persistent Volume Claim', 'Source', 'Reason', 'Age'];
      const headerNames = await sortableTable.headerNames();

      expect(headerNames).toEqual(expectedHeaders);
    });

    test('can open create page', async ({ page, login }) => {
      await login();
      const pvPage = new PersistentVolumesPagePo(page);

      await pvPage.goTo();
      await pvPage.waitForPage();

      await pvPage.list().masthead().create();
      await expect(page).toHaveURL(/\/persistentvolume\/create/);
    });

    test('can open Edit as YAML', async ({ page, login }) => {
      await login();
      const pvPage = new PersistentVolumesPagePo(page);

      await pvPage.goTo();
      await pvPage.waitForPage();

      await pvPage.list().masthead().create();

      const cruResource = pvPage.list().createEditView();

      await cruResource.editYamlButton().click();
      await expect(cruResource.yamlEditor()).toBeVisible();
    });
  });
});
