import { test, expect } from '@/support/fixtures';
import { RoleBindingsPagePo } from '@/e2e/po/pages/explorer/role-bindings.po';
import {
  roleBindingGetResponseEmpty,
  roleBindingResponseSmallSet,
} from '@/e2e/blueprints/explorer/rbac/role-bindings-get';

test.describe('RoleBindings', { tag: ['@explorer', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@noVai'] }, () => {
    test('validate role bindings table in empty state', async ({ page, login }) => {
      await login();

      await page.route('**/v1/rbac.authorization.k8s.io.rolebindings?*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(roleBindingGetResponseEmpty),
        });
      });

      const roleBindingsPage = new RoleBindingsPagePo(page);

      await roleBindingsPage.goTo();
      await roleBindingsPage.waitForPage();

      const sortableTable = roleBindingsPage.list().resourceTable().sortableTable();

      await sortableTable.checkVisible();
      await sortableTable.groupByButtons(0).click();
      await expect(sortableTable.tableHeaderRow()).toBeVisible();

      const expectedHeaders = ['State', 'Name', 'Namespace', 'Role', 'Users', 'Groups', 'Service Accounts', 'Age'];
      const headers = await sortableTable.headerNames();

      expect(headers).toEqual(expectedHeaders);
      await sortableTable.checkRowCount(true, 1);
    });

    test('flat list: validate role bindings table', async ({ page, login }) => {
      await login();

      await page.route('**/v1/rbac.authorization.k8s.io.rolebindings?*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(roleBindingResponseSmallSet),
        });
      });

      const roleBindingsPage = new RoleBindingsPagePo(page);

      await roleBindingsPage.goTo();
      await roleBindingsPage.waitForPage();

      const sortableTable = roleBindingsPage.list().resourceTable().sortableTable();

      await sortableTable.checkVisible();
      await sortableTable.checkLoadingIndicatorNotVisible();
      await sortableTable.groupByButtons(0).click();
      await expect(sortableTable.tableHeaderRow()).toBeVisible();

      const expectedHeaders = ['State', 'Name', 'Namespace', 'Role', 'Users', 'Groups', 'Service Accounts', 'Age'];
      const headers = await sortableTable.headerNames();

      expect(headers).toEqual(expectedHeaders);
      await sortableTable.noRowsShouldNotExist();
      await sortableTable.checkRowCount(false, 3);
    });

    test('group by namespace: validate role bindings table', async ({ page, login }) => {
      await login();

      await page.route('**/v1/rbac.authorization.k8s.io.rolebindings?*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(roleBindingResponseSmallSet),
        });
      });

      const roleBindingsPage = new RoleBindingsPagePo(page);

      await roleBindingsPage.goTo();
      await roleBindingsPage.waitForPage();

      const sortableTable = roleBindingsPage.list().resourceTable().sortableTable();

      await sortableTable.checkVisible();
      await sortableTable.groupByButtons(1).click();

      const expectedHeaders = ['State', 'Name', 'Role', 'Users', 'Groups', 'Service Accounts', 'Age'];

      await expect(sortableTable.tableHeaderRow()).toBeVisible();
      const headers = await sortableTable.headerNames();

      expect(headers).toEqual(expectedHeaders);
      await sortableTable.checkLoadingIndicatorNotVisible();
      await sortableTable.noRowsShouldNotExist();

      const groupRow = sortableTable.groupElementWithName('Namespace: kube-system');

      await groupRow.scrollIntoViewIfNeeded();
      await expect(groupRow).toBeVisible();
      await sortableTable.checkRowCount(false, 3);
    });
  });
});
