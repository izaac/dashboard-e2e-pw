import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';

test.describe('PersistentVolumeClaims', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@noVai', '@adminUser'] }, () => {
    test('validate persistent volume claims table headers', async ({ page, login }) => {
      await login();
      const pvcPage = new PagePo(page, '/c/local/explorer/persistentvolumeclaim');

      await pvcPage.goTo();
      await pvcPage.waitForPage();

      const sortableTable = new SortableTablePo(page, '.sortable-table');

      await sortableTable.checkVisible();
      const expectedHeaders = [
        'State',
        'Name',
        'Namespace',
        'Status',
        'Volume',
        'Capacity',
        'Access Modes',
        'Storage Class',
        'VolumeAttributesClass',
        'Volume Mode',
        'Age',
      ];
      const headerNames = await sortableTable.headerNames();

      expect(headerNames).toEqual(expectedHeaders);
    });

    test('validate table is visible', async ({ page, login }) => {
      await login();
      const pvcPage = new PagePo(page, '/c/local/explorer/persistentvolumeclaim');

      await pvcPage.goTo();
      await pvcPage.waitForPage();

      const sortableTable = new SortableTablePo(page, '.sortable-table');

      await sortableTable.checkVisible();
    });

    test('group by namespace shows namespace groups', async ({ page, login }) => {
      await login();
      const pvcPage = new PagePo(page, '/c/local/explorer/persistentvolumeclaim');

      await pvcPage.goTo();
      await pvcPage.waitForPage();

      const sortableTable = new SortableTablePo(page, '.sortable-table');

      await sortableTable.groupByButtons(1).click();
      await expect(sortableTable.self().locator('tr.group-row').first()).toBeVisible({ timeout: 15000 });
    });
  });
});
