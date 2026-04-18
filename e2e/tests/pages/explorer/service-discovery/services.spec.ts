import { test, expect } from '@/support/fixtures';
import { ServicesPagePo } from '@/e2e/po/pages/explorer/services.po';
import {
  servicesGetReponseEmpty,
  servicesGetResponseSmallSet,
} from '@/e2e/blueprints/explorer/workloads/service-discovery/services-get';

test.describe('Services', { tag: ['@explorer', '@adminUser'] }, () => {
  test.describe('CRUD', () => {
    const namespace = 'default';

    test('can create an ExternalName Service', async ({ page, login, rancherApi }) => {
      await login();

      const serviceExternalName = `svc-ext-${Date.now()}`;
      const servicesPage = new ServicesPagePo(page);

      await servicesPage.goTo();
      await servicesPage.waitForPage();
      await servicesPage.clickCreate();

      await servicesPage.externalNameTab().click();
      await expect(servicesPage.mastheadTitle()).toContainText('ExternalName');

      await servicesPage.nameInput().fill(serviceExternalName);
      await servicesPage.descriptionInput().fill(`${serviceExternalName}-desc`);

      await servicesPage.externalNameInput().fill('my.database.example.com');

      const createResponse = page.waitForResponse(
        (resp) => resp.url().includes('/v1/services') && resp.request().method() === 'POST',
      );

      await servicesPage.formSave().click();
      const resp = await createResponse;

      expect(resp.status()).toBe(201);

      try {
        await servicesPage.waitForPage();
        const sortableTable = servicesPage.list().resourceTable().sortableTable();

        await sortableTable.rowElementWithName(serviceExternalName).waitFor({ timeout: 15000 });
      } finally {
        await rancherApi.deleteRancherResource('v1', 'services', `${namespace}/${serviceExternalName}`, false);
      }
    });

    test('validation errors should not be shown when form is just opened', async ({ page, login }) => {
      await login();

      const servicesPage = new ServicesPagePo(page);

      await servicesPage.goTo();
      await servicesPage.waitForPage();
      await servicesPage.clickCreate();

      await expect(servicesPage.errorBanner()).not.toBeAttached();
    });
  });

  test.describe('List', { tag: ['@noVai'] }, () => {
    test('validate services table in empty state', async ({ page, login }) => {
      await login();

      await page.route('**/v1/services?*', (route) => {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(servicesGetReponseEmpty) });
      });

      const servicesPage = new ServicesPagePo(page);

      await servicesPage.goTo();
      await servicesPage.waitForPage();

      const expectedHeaders = ['State', 'Name', 'Namespace', 'Target', 'Selector', 'Type', 'Age'];
      const sortableTable = servicesPage.list().resourceTable().sortableTable();

      await sortableTable.checkVisible();
      await sortableTable.groupByButtons(0).click();
      await expect(sortableTable.tableHeaderRow()).toBeVisible();
      const headers = await sortableTable.headerNames();

      expect(headers).toEqual(expectedHeaders);
      await sortableTable.checkRowCount(true, 1);
    });

    test('flat list: validate services table', async ({ page, login }) => {
      await login();

      await page.route('**/v1/services?*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(servicesGetResponseSmallSet),
        });
      });

      const servicesPage = new ServicesPagePo(page);

      await servicesPage.goTo();
      await servicesPage.waitForPage();

      const expectedHeaders = ['State', 'Name', 'Namespace', 'Target', 'Selector', 'Type', 'Age'];
      const sortableTable = servicesPage.list().resourceTable().sortableTable();

      await sortableTable.checkVisible();
      await sortableTable.checkLoadingIndicatorNotVisible();
      await sortableTable.groupByButtons(0).click();
      await expect(sortableTable.tableHeaderRow()).toBeVisible();
      const headers = await sortableTable.headerNames();

      expect(headers).toEqual(expectedHeaders);
      await sortableTable.noRowsShouldNotExist();
      await sortableTable.checkRowCount(false, 3);
    });

    test('group by namespace: validate services table', async ({ page, login }) => {
      await login();

      await page.route('**/v1/services?*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(servicesGetResponseSmallSet),
        });
      });

      const servicesPage = new ServicesPagePo(page);

      await servicesPage.goTo();
      await servicesPage.waitForPage();

      const sortableTable = servicesPage.list().resourceTable().sortableTable();

      await sortableTable.groupByButtons(1).click();

      const expectedHeaders = ['State', 'Name', 'Target', 'Selector', 'Type', 'Age'];

      await sortableTable.checkVisible();
      await sortableTable.checkLoadingIndicatorNotVisible();
      await expect(sortableTable.tableHeaderRow()).toBeVisible();
      const headers = await sortableTable.headerNames();

      expect(headers).toEqual(expectedHeaders);
      await sortableTable.noRowsShouldNotExist();

      const groupRow = sortableTable.groupElementWithName('Namespace: cattle-system');

      await groupRow.scrollIntoViewIfNeeded();
      await expect(groupRow).toBeVisible();
      await sortableTable.checkRowCount(false, 3);
    });
  });
});
