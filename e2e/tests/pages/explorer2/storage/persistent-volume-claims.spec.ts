import { test, expect } from '@/support/fixtures';
import { PersistentVolumeClaimsListPagePo } from '@/e2e/po/pages/explorer/storage/persistent-volume-claims.po';

test.describe('PersistentVolumeClaims', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@noVai', '@adminUser'] }, () => {
    test('validate persistent volume claims table headers', async ({ page, login }) => {
      await login();
      const pvcPage = new PersistentVolumeClaimsListPagePo(page);

      await pvcPage.goTo();
      await pvcPage.waitForPage();

      const sortableTable = pvcPage.sortableTable();

      await sortableTable.checkVisible();
      // Namespace column may not appear in 2.13 when the table is empty
      const expectedHeaders = [
        'State',
        'Name',
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
      const pvcPage = new PersistentVolumeClaimsListPagePo(page);

      await pvcPage.goTo();
      await pvcPage.waitForPage();

      const sortableTable = pvcPage.sortableTable();

      await sortableTable.checkVisible();
    });

    test('group by namespace shows namespace groups', async ({ page, login }) => {
      await login();
      const pvcPage = new PersistentVolumeClaimsListPagePo(page);

      await pvcPage.goTo();
      await pvcPage.waitForPage();

      const sortableTable = pvcPage.sortableTable();
      const rowCount = await sortableTable.rowCount();

      test.skip(rowCount === 0, 'No PVCs exist to group by namespace');

      await sortableTable.groupByButtons(1).click();
      await expect(sortableTable.groupRows().first()).toBeVisible({ timeout: 15000 });
    });
  });
});
