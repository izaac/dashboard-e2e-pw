import { test, expect } from '@/support/fixtures';
import { ClusterRoleBindingsPagePo } from '@/e2e/po/pages/explorer/cluster-role-bindings.po';
import {
  clusterRoleBindingGetResponseEmpty,
  clusterRoleBindingResponseSmallSet,
} from '@/e2e/blueprints/explorer/rbac/cluster-role-bindings-get';

const expectedHeaders = ['State', 'Name', 'Role', 'Users', 'Groups', 'Service Accounts', 'Age'];

test.describe('ClusterRoleBindings', { tag: ['@explorer', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@noVai'] }, () => {
    test('validate cluster role bindings table in empty state', async ({ page, login }) => {
      await login();

      await page.route('**/v1/rbac.authorization.k8s.io.clusterrolebindings?*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(clusterRoleBindingGetResponseEmpty),
        });
      });

      const clusterRoleBindingsPage = new ClusterRoleBindingsPagePo(page);

      await clusterRoleBindingsPage.goTo();
      await clusterRoleBindingsPage.waitForPage();

      const sortableTable = clusterRoleBindingsPage.list().resourceTable().sortableTable();

      await expect(sortableTable.self()).toBeVisible();
      await expect(sortableTable.tableHeaderRow()).toBeVisible();
      const headers = await sortableTable.headerNames();

      expect(headers).toEqual(expectedHeaders);
      await sortableTable.checkRowCount(true, 1);
    });

    test('validate cluster role bindings table', async ({ page, login }) => {
      await login();

      await page.route('**/v1/rbac.authorization.k8s.io.clusterrolebindings?*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(clusterRoleBindingResponseSmallSet),
        });
      });

      const clusterRoleBindingsPage = new ClusterRoleBindingsPagePo(page);

      await clusterRoleBindingsPage.goTo();
      await clusterRoleBindingsPage.waitForPage();

      const sortableTable = clusterRoleBindingsPage.list().resourceTable().sortableTable();

      await expect(sortableTable.self()).toBeVisible();
      await sortableTable.checkLoadingIndicatorNotVisible();
      await expect(sortableTable.tableHeaderRow()).toBeVisible();
      const headers = await sortableTable.headerNames();

      expect(headers).toEqual(expectedHeaders);
      await sortableTable.noRowsShouldNotExist();
      await sortableTable.checkRowCount(false, 2);
    });
  });
});
