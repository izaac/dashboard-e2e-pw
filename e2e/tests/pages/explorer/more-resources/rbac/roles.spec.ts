import { test, expect } from '@/support/fixtures';
import { RolesPagePo } from '@/e2e/po/pages/explorer/roles.po';
import { rolesGetResponseEmpty, rolesResponseSmallSet } from '@/e2e/blueprints/explorer/rbac/roles-get';

test.describe('Roles', { tag: ['@explorer', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@noVai'] }, () => {
    test('validate roles table in empty state', async ({ page, login }) => {
      await login();

      await page.route('**/v1/rbac.authorization.k8s.io.roles?*', (route) => {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rolesGetResponseEmpty) });
      });

      const rolesPage = new RolesPagePo(page);

      await rolesPage.goTo();
      await rolesPage.waitForPage();

      const sortableTable = rolesPage.list().resourceTable().sortableTable();

      await sortableTable.checkVisible();
      await sortableTable.groupByButtons(0).click();
      await expect(sortableTable.tableHeaderRow()).toBeVisible();

      const expectedHeaders = ['State', 'Name', 'Namespace', 'Created At'];
      const headers = await sortableTable.headerNames();

      expect(headers).toEqual(expectedHeaders);
      await sortableTable.checkRowCount(true, 1);
    });

    test('flat list: validate roles table', async ({ page, login }) => {
      await login();

      await page.route('**/v1/rbac.authorization.k8s.io.roles?*', (route) => {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rolesResponseSmallSet()) });
      });

      const rolesPage = new RolesPagePo(page);

      await rolesPage.goTo();
      await rolesPage.waitForPage();

      const sortableTable = rolesPage.list().resourceTable().sortableTable();

      await sortableTable.checkVisible();
      await sortableTable.checkLoadingIndicatorNotVisible();
      await sortableTable.groupByButtons(0).click();
      await expect(sortableTable.tableHeaderRow()).toBeVisible();

      const expectedHeaders = ['State', 'Name', 'Namespace', 'Created At'];
      const headers = await sortableTable.headerNames();

      expect(headers).toEqual(expectedHeaders);
      await sortableTable.noRowsShouldNotExist();
      await sortableTable.checkRowCount(false, 2);
    });

    test('group by namespace: validate roles table', async ({ page, login }) => {
      await login();

      const ns = 'saddsfdsf';

      await page.route('**/v1/rbac.authorization.k8s.io.roles?*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(rolesResponseSmallSet(ns)),
        });
      });

      const rolesPage = new RolesPagePo(page);

      await rolesPage.goTo();
      await rolesPage.waitForPage();

      const sortableTable = rolesPage.list().resourceTable().sortableTable();

      await sortableTable.checkVisible();
      await sortableTable.groupByButtons(1).click();

      const expectedHeaders = ['State', 'Name', 'Created At'];

      await expect(sortableTable.tableHeaderRow()).toBeVisible();
      const headers = await sortableTable.headerNames();

      expect(headers).toEqual(expectedHeaders);
      await sortableTable.checkLoadingIndicatorNotVisible();
      await sortableTable.noRowsShouldNotExist();

      const groupRow = sortableTable.groupElementWithName(`Namespace: ${ns}`);

      await groupRow.scrollIntoViewIfNeeded();
      await expect(groupRow).toBeVisible();
    });
  });
});
