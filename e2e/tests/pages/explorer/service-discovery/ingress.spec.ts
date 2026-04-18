import { test, expect } from '@/support/fixtures';
import { IngressListPagePo } from '@/e2e/po/pages/explorer/ingress.po';
import {
  ingressesGetReponseEmpty,
  ingressesGetResponseSmallSet,
} from '@/e2e/blueprints/explorer/workloads/service-discovery/ingresses-get';

test.describe('Ingresses', { tag: ['@explorer', '@adminUser'] }, () => {
  test('does not show console warning due to lack of secondary schemas', async ({ page, login }) => {
    await login();

    const consoleWarnings: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    const ingressListPage = new IngressListPagePo(page);

    await ingressListPage.goTo();
    await ingressListPage.waitForPage();

    const warnMsg =
      "pathExistsInSchema requires schema networking.k8s.io.ingress to have resources fields via schema definition but none were found. has the schema 'fetchResourceFields' been called?";

    expect(consoleWarnings).not.toContain(warnMsg);
  });

  test.describe('Create/Edit', () => {
    test.skip(true, 'CRUD tests require createManyNamespacedResources helper — skipped for now');

    test('can select rules and certificates in Create mode', async () => {
      // requires complex setup with secrets and services
    });

    test('can select rules and certificates in Edit mode', async () => {
      // requires complex setup with secrets and services
    });

    test('can create an Ingress targeting a headless service', async () => {
      // requires complex setup
    });
  });

  test.describe('List', { tag: ['@noVai'] }, () => {
    test('validate ingresses table in empty state', async ({ page, login }) => {
      await login();

      await page.route('**/v1/networking.k8s.io.ingresses?*', (route) => {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ingressesGetReponseEmpty) });
      });

      const ingressListPage = new IngressListPagePo(page);

      await ingressListPage.goTo();
      await ingressListPage.waitForPage();

      const expectedHeaders = ['State', 'Name', 'Namespace', 'Target', 'Default', 'Ingress Class', 'Age'];
      const sortableTable = ingressListPage.list().resourceTable().sortableTable();

      await sortableTable.checkVisible();
      await sortableTable.groupByButtons(0).click();
      await expect(sortableTable.tableHeaderRow()).toBeVisible();
      const headers = await sortableTable.headerNames();

      expect(headers).toEqual(expectedHeaders);
      await sortableTable.checkRowCount(true, 1);
    });

    test('flat list: validate ingresses table', async ({ page, login }) => {
      await login();

      await page.route('**/v1/networking.k8s.io.ingresses?*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(ingressesGetResponseSmallSet),
        });
      });

      const ingressListPage = new IngressListPagePo(page);

      await ingressListPage.goTo();
      await ingressListPage.waitForPage();

      const expectedHeaders = ['State', 'Name', 'Namespace', 'Target', 'Default', 'Ingress Class', 'Age'];
      const sortableTable = ingressListPage.list().resourceTable().sortableTable();

      await sortableTable.checkVisible();
      await sortableTable.checkLoadingIndicatorNotVisible();
      await sortableTable.groupByButtons(0).click();
      await expect(sortableTable.tableHeaderRow()).toBeVisible();
      const headers = await sortableTable.headerNames();

      expect(headers).toEqual(expectedHeaders);
      await sortableTable.noRowsShouldNotExist();
      await sortableTable.checkRowCount(false, 2);
    });

    test('group by namespace: validate ingresses table', async ({ page, login }) => {
      await login();

      await page.route('**/v1/networking.k8s.io.ingresses?*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(ingressesGetResponseSmallSet),
        });
      });

      const ingressListPage = new IngressListPagePo(page);

      await ingressListPage.goTo();
      await ingressListPage.waitForPage();

      const sortableTable = ingressListPage.list().resourceTable().sortableTable();

      await sortableTable.groupByButtons(1).click();

      const expectedHeaders = ['State', 'Name', 'Target', 'Default', 'Ingress Class', 'Age'];

      await sortableTable.checkVisible();
      await sortableTable.checkLoadingIndicatorNotVisible();
      await expect(sortableTable.tableHeaderRow()).toBeVisible();
      const headers = await sortableTable.headerNames();

      expect(headers).toEqual(expectedHeaders);
      await sortableTable.noRowsShouldNotExist();

      const groupRow = sortableTable.groupElementWithName('Namespace: cattle-system');

      await expect(groupRow).toBeVisible();
      await sortableTable.checkRowCount(false, 2);
    });
  });
});
