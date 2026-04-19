import { test, expect } from '@/support/fixtures';
import { PersistentVolumesListPagePo } from '@/e2e/po/pages/explorer/storage/persistent-volumes.po';

test.describe('PersistentVolumes', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@noVai', '@adminUser'] }, () => {
    test('validate persistent volumes table headers', async ({ page, login }) => {
      await login();
      const pvPage = new PersistentVolumesListPagePo(page);

      await pvPage.goTo();
      await pvPage.waitForPage();

      const sortableTable = pvPage.sortableTable();

      await sortableTable.checkVisible();
      const expectedHeaders = ['State', 'Name', 'Reclaim Policy', 'Persistent Volume Claim', 'Source', 'Reason', 'Age'];
      const headerNames = await sortableTable.headerNames();

      expect(headerNames).toEqual(expectedHeaders);
    });

    test('can open create page', async ({ page, login }) => {
      await login();
      const pvPage = new PersistentVolumesListPagePo(page);

      await pvPage.goTo();
      await pvPage.waitForPage();

      await pvPage.masthead().create();
      await expect(page).toHaveURL(/\/persistentvolume\/create/);
    });

    test('can open Edit as YAML', async ({ page, login }) => {
      await login();
      const pvPage = new PersistentVolumesListPagePo(page);

      await pvPage.goTo();
      await pvPage.waitForPage();

      await pvPage.masthead().create();
      await pvPage.createEditView().editAsYaml();
      await expect(pvPage.yamlEditor()).toBeVisible();
    });
  });
});
