import { test, expect } from '@/support/fixtures';
import { ClusterRolesPagePo } from '@/e2e/po/pages/explorer/cluster-roles.po';
import {
  clusterRolesGetResponseEmpty,
  clusterRolesResponseSmallSet,
} from '@/e2e/blueprints/explorer/rbac/cluster-roles-get';

const expectedHeaders = ['State', 'Name', 'Created At'];

test.describe('ClusterRoles', { tag: ['@explorer', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@noVai'] }, () => {
    test('validate cluster roles table in empty state', async ({ page, login }) => {
      await login();

      await page.route('**/v1/rbac.authorization.k8s.io.clusterroles?*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(clusterRolesGetResponseEmpty),
        });
      });

      const clusterRolesPage = new ClusterRolesPagePo(page);

      await clusterRolesPage.goTo();
      await clusterRolesPage.waitForPage();

      const sortableTable = clusterRolesPage.list().resourceTable().sortableTable();

      await sortableTable.checkVisible();
      await expect(sortableTable.tableHeaderRow()).toBeVisible();
      const headers = await sortableTable.headerNames();

      expect(headers).toEqual(expectedHeaders);
      await sortableTable.checkRowCount(true, 1);
    });

    test('validate cluster roles table', async ({ page, login }) => {
      await login();

      await page.route('**/v1/rbac.authorization.k8s.io.clusterroles?*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(clusterRolesResponseSmallSet),
        });
      });

      const clusterRolesPage = new ClusterRolesPagePo(page);

      await clusterRolesPage.goTo();
      await clusterRolesPage.waitForPage();

      const sortableTable = clusterRolesPage.list().resourceTable().sortableTable();

      await sortableTable.checkVisible();
      await sortableTable.checkLoadingIndicatorNotVisible();
      await expect(sortableTable.tableHeaderRow()).toBeVisible();
      const headers = await sortableTable.headerNames();

      expect(headers).toEqual(expectedHeaders);
      await sortableTable.noRowsShouldNotExist();
      await sortableTable.checkRowCount(false, 2);
    });
  });
});
