import { test, expect } from '@/support/fixtures';
import { ServicesPagePo } from '@/e2e/po/pages/explorer/services.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
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

        await expect(sortableTable.rowElementWithName(serviceExternalName)).toBeVisible();
      } finally {
        await rancherApi.deleteRancherResource('v1', 'services', `${namespace}/${serviceExternalName}`, false);
      }
    });

    test('can edit an ExternalName Service', async ({ page, login, rancherApi }) => {
      await login();

      const serviceName = `svc-ext-edit-${Date.now()}`;
      const servicesPage = new ServicesPagePo(page);

      await rancherApi.createRancherResource('v1', 'services', {
        metadata: { name: serviceName, namespace },
        spec: {
          type: 'ExternalName',
          externalName: 'my.database.example.com',
          ports: [{ port: 80, protocol: 'TCP', targetPort: 80 }],
        },
      });

      try {
        await servicesPage.goTo();
        await servicesPage.waitForPage();

        const sortableTable = servicesPage.list().resourceTable().sortableTable();

        await sortableTable.checkVisible();
        const actionMenu = await sortableTable.rowActionMenuOpen(serviceName);

        await actionMenu.getMenuItem('Edit Config').click();
        await page.waitForURL(/mode=edit/);

        await servicesPage.descriptionInput().fill(`${serviceName}-desc`);

        const saveResponse = page.waitForResponse(
          (resp) =>
            resp.url().includes(`/v1/services/${namespace}/${serviceName}`) && resp.request().method() === 'PUT',
          { timeout: 30000 },
        );

        await servicesPage.formSave().click();
        const resp = await saveResponse;

        expect(resp.status()).toBe(200);

        await servicesPage.waitForPage();
      } finally {
        await rancherApi.deleteRancherResource('v1', 'services', `${namespace}/${serviceName}`, false);
      }
    });

    test('can clone an ExternalName Service', async ({ page, login, rancherApi }) => {
      await login();

      const serviceName = `svc-ext-clone-${Date.now()}`;
      const cloneName = `clone-${serviceName}`;
      const servicesPage = new ServicesPagePo(page);

      await rancherApi.createRancherResource('v1', 'services', {
        metadata: { name: serviceName, namespace },
        spec: {
          type: 'ExternalName',
          externalName: 'my.database.example.com',
          ports: [{ port: 80, protocol: 'TCP', targetPort: 80 }],
        },
      });

      try {
        await servicesPage.goTo();
        await servicesPage.waitForPage();

        const sortableTable = servicesPage.list().resourceTable().sortableTable();

        await sortableTable.checkVisible();
        const actionMenu = await sortableTable.rowActionMenuOpen(serviceName);

        await actionMenu.getMenuItem('Clone').click();
        await page.waitForURL(/mode=clone/);

        await servicesPage.nameInput().fill(cloneName);

        const saveResponse = page.waitForResponse(
          (resp) => resp.url().includes('/v1/services') && resp.request().method() === 'POST',
          { timeout: 30000 },
        );

        await servicesPage.formSave().click();
        const resp = await saveResponse;

        expect(resp.status()).toBe(201);

        await servicesPage.waitForPage();
        await sortableTable.checkVisible();
        await expect(sortableTable.rowElementWithName(cloneName)).toBeVisible();
      } finally {
        await rancherApi.deleteRancherResource('v1', 'services', `${namespace}/${serviceName}`, false);
        await rancherApi.deleteRancherResource('v1', 'services', `${namespace}/${cloneName}`, false);
      }
    });

    test('can edit YAML of an ExternalName Service', async ({ page, login, rancherApi }) => {
      await login();

      const serviceName = `svc-ext-yaml-${Date.now()}`;
      const servicesPage = new ServicesPagePo(page);

      await rancherApi.createRancherResource('v1', 'services', {
        metadata: { name: serviceName, namespace },
        spec: {
          type: 'ExternalName',
          externalName: 'my.database.example.com',
          ports: [{ port: 80, protocol: 'TCP', targetPort: 80 }],
        },
      });

      try {
        await servicesPage.goTo();
        await servicesPage.waitForPage();

        const sortableTable = servicesPage.list().resourceTable().sortableTable();

        await sortableTable.checkVisible();
        const actionMenu = await sortableTable.rowActionMenuOpen(serviceName);

        await actionMenu.getMenuItem('Edit YAML').click();
        await page.waitForURL(/as=yaml/);

        await expect(servicesPage.mastheadTitle()).toContainText(`Service: ${serviceName}`);
      } finally {
        await rancherApi.deleteRancherResource('v1', 'services', `${namespace}/${serviceName}`, false);
      }
    });

    test('can delete an ExternalName Service', async ({ page, login, rancherApi }) => {
      await login();

      const serviceName = `svc-ext-del-${Date.now()}`;
      const servicesPage = new ServicesPagePo(page);

      await rancherApi.createRancherResource('v1', 'services', {
        metadata: { name: serviceName, namespace },
        spec: {
          type: 'ExternalName',
          externalName: 'my.database.example.com',
          ports: [{ port: 80, protocol: 'TCP', targetPort: 80 }],
        },
      });

      await servicesPage.goTo();
      await servicesPage.waitForPage();

      const sortableTable = servicesPage.list().resourceTable().sortableTable();

      await sortableTable.checkVisible();
      const actionMenu = await sortableTable.rowActionMenuOpen(serviceName);

      await actionMenu.getMenuItem('Delete').click();

      const promptRemove = new PromptRemove(page);

      await expect(promptRemove.self()).toBeVisible();

      const deleteResponse = page.waitForResponse(
        (resp) =>
          resp.url().includes(`/v1/services/${namespace}/${serviceName}`) && resp.request().method() === 'DELETE',
        { timeout: 30000 },
      );

      await promptRemove.remove();
      await deleteResponse;

      await expect(sortableTable.rowElementWithName(serviceName)).toBeHidden();
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
