import { test, expect } from '@/support/fixtures';
import { ServiceAccountsPagePo } from '@/e2e/po/pages/explorer/service-accounts.po';
import {
  serviceAccGetResponseEmpty,
  serviceAcctResponseSmallSet,
} from '@/e2e/blueprints/explorer/core/service-accounts-get';
import { SHORT_TIMEOUT_OPT } from '@/support/utils/timeouts';

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

      await expect(serviceAccountsPage.list().resourceTable().sortableTable().self()).toBeVisible();

      const headerCells = serviceAccountsPage.list().resourceTable().sortableTable().headerContentCells();

      await expect(headerCells.first()).toBeVisible(SHORT_TIMEOUT_OPT);

      const headers = await serviceAccountsPage.list().resourceTable().sortableTable().headerNames();

      expect(headers).toContain('State');
      expect(headers).toContain('Name');
      expect(headers).toContain('Age');

      await expect(serviceAccountsPage.list().resourceTable().sortableTable().rowElements()).toHaveCount(1);
      await expect(serviceAccountsPage.list().resourceTable().sortableTable().noRowsText()).toBeVisible();
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

      await expect(serviceAccountsPage.list().resourceTable().sortableTable().self()).toBeVisible();

      const headerCells = serviceAccountsPage.list().resourceTable().sortableTable().headerContentCells();

      await expect(headerCells.first()).toBeVisible(SHORT_TIMEOUT_OPT);

      const headers = await serviceAccountsPage.list().resourceTable().sortableTable().headerNames();

      expect(headers).toContain('State');
      expect(headers).toContain('Name');
      expect(headers).toContain('Age');

      await serviceAccountsPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();
      await expect(serviceAccountsPage.list().resourceTable().sortableTable().noRowsText()).not.toBeAttached();
      await expect(serviceAccountsPage.list().resourceTable().sortableTable().rowElements()).toHaveCount(3);
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

      await expect(serviceAccountsPage.list().resourceTable().sortableTable().self()).toBeVisible();
      await serviceAccountsPage.list().resourceTable().sortableTable().checkLoadingIndicatorNotVisible();
      await expect(serviceAccountsPage.list().resourceTable().sortableTable().noRowsText()).not.toBeAttached();

      const groupRow = serviceAccountsPage
        .list()
        .resourceTable()
        .sortableTable()
        .groupElementWithName('Namespace: cattle-system');

      await groupRow.scrollIntoViewIfNeeded();
      await expect(groupRow).toBeVisible();

      await expect(serviceAccountsPage.list().resourceTable().sortableTable().rowElements()).toHaveCount(3);
    });
  });
});
