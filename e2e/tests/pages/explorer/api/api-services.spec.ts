import { test, expect } from '@/support/fixtures';
import { APIServicesPagePo } from '@/e2e/po/pages/explorer/api-services.po';

test.describe('Cluster Explorer', { tag: ['@explorer', '@adminUser'] }, () => {
  test.describe('API: APIServices', () => {
    test('should be able to use shift+j to select rows and the count of selected is correct', async ({
      page,
      login,
    }) => {
      await login();
      const apiServicesPage = new APIServicesPagePo(page, 'local');

      await apiServicesPage.goTo();
      await apiServicesPage.waitForPage();

      await expect(apiServicesPage.title().title()).toContainText('APIServices');

      const sortableTable = apiServicesPage.sortableTable();
      const count = 3;

      await sortableTable.checkLoadingIndicatorNotVisible();
      await expect.poll(() => sortableTable.rowCount(), { timeout: 15_000 }).toBeGreaterThanOrEqual(count);

      for (let i = 0; i < count; i++) {
        await page.keyboard.down('Shift');
        await page.keyboard.press('j');
        await page.keyboard.up('Shift');
        await expect(sortableTable.selectedCountText()).toContainText(`${i + 1} selected`);
      }

      await expect(sortableTable.selectedCountText()).toContainText(`${count} selected`);

      const selected = await sortableTable.selectedCount();

      expect(selected).toBe(count);
    });
  });
});
