import { test, expect } from '@/support/fixtures';
import { ServiceAccountsPagePo } from '@/e2e/po/pages/explorer/service-accounts.po';
import {
  serviceAccGetResponseEmpty,
  serviceAcctResponseSmallSet,
} from '@/e2e/blueprints/explorer/core/service-accounts-get';

test.describe('Service Accounts', { tag: ['@explorer', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@noVai', '@adminUser'] }, () => {
    test('validate services table in empty state', async ({ page, login, rancherApi }) => {
      await login();

      const revision = await rancherApi.fetchRevision();

      await page.route(/\/v1\/serviceaccounts\?/, async (route) => {
        await route.fulfill({ json: { ...serviceAccGetResponseEmpty, revision } });
      });

      const serviceAccountsPage = new ServiceAccountsPagePo(page, 'local');

      await serviceAccountsPage.goTo();
      await serviceAccountsPage.waitForPage();

      await serviceAccountsPage.list().resourceTable().sortableTable().checkVisible();

      await expect(serviceAccountsPage.list().resourceTable().sortableTable().headerContentCells().first()).toBeVisible(
        { timeout: 15000 },
      );

      const headers = await serviceAccountsPage.list().resourceTable().sortableTable().headerNames();

      expect(headers).toContain('State');
      expect(headers).toContain('Name');
      expect(headers).toContain('Age');

      await serviceAccountsPage.list().resourceTable().sortableTable().checkRowCount(true, 1);
    });

    test('flat list: validate services table', async ({ page, login, rancherApi }) => {
      await login();

      const revision = await rancherApi.fetchRevision();

      await page.route(/\/v1\/serviceaccounts\?/, async (route) => {
        await route.fulfill({ json: { ...serviceAcctResponseSmallSet, revision } });
      });

      const serviceAccountsPage = new ServiceAccountsPagePo(page, 'local');

      await serviceAccountsPage.goTo();
      await serviceAccountsPage.waitForPage();

      await serviceAccountsPage.list().resourceTable().sortableTable().checkVisible();

      await expect(serviceAccountsPage.list().resourceTable().sortableTable().headerContentCells().first()).toBeVisible(
        { timeout: 15000 },
      );

      const headers = await serviceAccountsPage.list().resourceTable().sortableTable().headerNames();

      expect(headers).toContain('State');
      expect(headers).toContain('Name');
      expect(headers).toContain('Age');

      await serviceAccountsPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();
      await serviceAccountsPage.list().resourceTable().sortableTable().noRowsShouldNotExist();
      await serviceAccountsPage.list().resourceTable().sortableTable().checkRowCount(false, 3);
    });

    test('group by namespace: validate services table', async ({ page, login, rancherApi }) => {
      await login();

      const revision = await rancherApi.fetchRevision();

      await page.route(/\/v1\/serviceaccounts\?/, async (route) => {
        await route.fulfill({ json: { ...serviceAcctResponseSmallSet, revision } });
      });

      const serviceAccountsPage = new ServiceAccountsPagePo(page, 'local');

      await serviceAccountsPage.goTo();
      await serviceAccountsPage.waitForPage();

      await serviceAccountsPage.list().resourceTable().sortableTable().groupByButtons(1).click();

      const headers = await serviceAccountsPage.list().resourceTable().sortableTable().headerNames();

      expect(headers).toContain('State');
      expect(headers).toContain('Name');
      expect(headers).toContain('Age');

      await serviceAccountsPage.list().resourceTable().sortableTable().checkVisible();
      await serviceAccountsPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();
      await serviceAccountsPage.list().resourceTable().sortableTable().noRowsShouldNotExist();

      const groupRow = serviceAccountsPage
        .list()
        .resourceTable()
        .sortableTable()
        .groupElementWithName('Namespace: cattle-system');

      await groupRow.scrollIntoViewIfNeeded();
      await expect(groupRow).toBeVisible();

      await serviceAccountsPage.list().resourceTable().sortableTable().checkRowCount(false, 3);
    });
  });
});
