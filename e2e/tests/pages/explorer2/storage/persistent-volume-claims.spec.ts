import { test, expect } from '@/support/fixtures';
import { PersistentVolumeClaimsPagePo } from '@/e2e/po/pages/explorer/persistent-volume-claims.po';

test.describe('PersistentVolumeClaims', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@noVai', '@adminUser'] }, () => {
    test('validate persistent volume claims table headers', async ({ page, login }) => {
      await login();
      const pvcPage = new PersistentVolumeClaimsPagePo(page);

      await pvcPage.goTo();
      await pvcPage.waitForPage();

      const sortableTable = pvcPage.list().resourceTable().sortableTable();
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
      const pvcPage = new PersistentVolumeClaimsPagePo(page);

      await pvcPage.goTo();
      await pvcPage.waitForPage();

      const sortableTable = pvcPage.list().resourceTable().sortableTable();

      await sortableTable.checkVisible();
    });

    test('group by namespace shows namespace groups', async ({ page, login }) => {
      await login();
      const pvcPage = new PersistentVolumeClaimsPagePo(page);

      await pvcPage.goTo();
      await pvcPage.waitForPage();

      const sortableTable = pvcPage.list().resourceTable().sortableTable();

      await sortableTable.groupByButtons(1).click();
      await expect(sortableTable.groupRows().first()).toBeVisible({ timeout: 15000 });
    });
  });
});
