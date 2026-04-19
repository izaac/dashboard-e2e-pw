import { test, expect } from '@/support/fixtures';
import { ContentsPagePo } from '@/e2e/po/pages/explorer/contents.po';
import {
  fleetContentsGetResponseEmpty,
  fleetContentsResponseSmallSet,
} from '@/e2e/blueprints/explorer/fleet/contents-get';

test.describe('Contents', { tag: ['@explorer', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@noVai', '@adminUser'] }, () => {
    test('validate fleet contents table in empty state', async ({ page, login, rancherApi }) => {
      await login();
      const contentsPage = new ContentsPagePo(page, 'local');

      const revision = await rancherApi.fetchRevision();
      const mockData = { ...fleetContentsGetResponseEmpty, revision };

      await page.route(/\/v1\/fleet\.cattle\.io\.contents/, async (route) => {
        await route.fulfill({ json: mockData });
      });

      await contentsPage.goTo();
      await contentsPage.waitForPage();

      await contentsPage.list().resourceTable().sortableTable().checkVisible();

      const headers = await contentsPage.list().resourceTable().sortableTable().headerNames();

      expect(headers).toContain('State');
      expect(headers).toContain('Name');
      expect(headers).toContain('Age');

      await contentsPage.list().resourceTable().sortableTable().checkRowCount(true, 1);
    });

    test('validate fleet contents table', async ({ page, login, rancherApi }) => {
      await login();
      const contentsPage = new ContentsPagePo(page, 'local');

      const revision = await rancherApi.fetchRevision();
      const mockData = { ...fleetContentsResponseSmallSet, revision };

      await page.route(/\/v1\/fleet\.cattle\.io\.contents/, async (route) => {
        await route.fulfill({ json: mockData });
      });

      await contentsPage.goTo();
      await contentsPage.waitForPage();

      await contentsPage.list().resourceTable().sortableTable().checkVisible();
      await contentsPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();

      await expect(contentsPage.list().resourceTable().sortableTable().headerContentCells().first()).toBeVisible({
        timeout: 15000,
      });

      const headers = await contentsPage.list().resourceTable().sortableTable().headerNames();

      expect(headers).toContain('State');
      expect(headers).toContain('Name');
      expect(headers).toContain('Age');

      await contentsPage.list().resourceTable().sortableTable().noRowsShouldNotExist();
      await contentsPage.list().resourceTable().sortableTable().checkRowCount(false, 2);
    });
  });
});
