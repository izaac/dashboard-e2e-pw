import { test, expect } from '@/support/fixtures';
import { ConfigMapsPagePo } from '@/e2e/po/pages/explorer/configmaps.po';
import { configmapLargeResponse } from '@/e2e/blueprints/explorer2/storage/configmap-collection';
import { setTablePreferences, restoreTablePreferences } from '@/e2e/tests/pages/explorer2/workloads/pagination.utils';

test.describe('ConfigMap', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('has the correct title', async ({ page, rancherApi }) => {
    const configMapListPage = new ConfigMapsPagePo(page);

    await configMapListPage.goTo();

    const masthead = configMapListPage.list().masthead();

    await expect(masthead.title()).toContainText('ConfigMaps');

    const version = await rancherApi.getRancherVersion();
    const expectedTitle =
      version.RancherPrime === 'true' ? 'Rancher Prime - local - ConfigMaps' : 'Rancher - local - ConfigMaps';

    await expect(page).toHaveTitle(expectedTitle);
  });

  test('creates a configmap and displays it in the list', async ({ page, rancherApi }) => {
    const configMapName = `e2e-test-${Date.now()}-custom-config-map`;
    const namespace = 'default';

    const configMapListPage = new ConfigMapsPagePo(page);

    await configMapListPage.goTo();
    await configMapListPage.waitForPage();

    await configMapListPage.list().masthead().create();

    const cruResource = configMapListPage.list().createEditView();

    await cruResource.nameNsDescription().name().set(configMapName);

    await cruResource.keyInput(0).fill('managerApiConfiguration.properties');
    await cruResource.nameNsDescription().description().set('Custom Config Map Description');

    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/v1/configmaps') && resp.request().method() === 'POST',
    );

    await cruResource.formSave().click();

    const response = await responsePromise;

    expect(response.status()).toBe(201);
    const body = await response.json();

    expect(body.metadata.name).toBe(configMapName);

    try {
      await configMapListPage.waitForPage();

      const sortableTable = configMapListPage.list().resourceTable().sortableTable();

      await sortableTable.filter(configMapName);
      await expect(sortableTable.rowElements()).toHaveCount(1);
    } finally {
      await rancherApi.deleteRancherResource('v1', `configmaps/${namespace}`, configMapName, false);
    }
  });

  test('should show an error banner if the api call sends back an error', async ({ page }) => {
    const configMapListPage = new ConfigMapsPagePo(page);

    await configMapListPage.goTo();
    await configMapListPage.waitForPage();

    await configMapListPage.list().masthead().create();

    const cruResource = configMapListPage.list().createEditView();

    await cruResource.nameNsDescription().name().set('$^$^"£%');
    await cruResource.formSave().click();

    await expect(cruResource.errorBanner()).toBeVisible();
  });

  test.describe('List', { tag: ['@noVai', '@adminUser'] }, () => {
    const MOCK_COUNT = 25;
    const UNIQUE_NAME = 'aaaa-unique-configmap';

    test('pagination is visible and navigable with large dataset', async ({ page, login, rancherApi }) => {
      const savedPrefs = await setTablePreferences(rancherApi, []);
      const mockData = configmapLargeResponse(MOCK_COUNT, UNIQUE_NAME);

      try {
        await page.route(/\/v1\/configmaps/, (route) => {
          const url = route.request().url();

          if (url.includes('watch=true') || url.includes('resourceVersion')) {
            return route.abort();
          }

          return route.fulfill({ json: mockData });
        });

        await login();
        const configMapListPage = new ConfigMapsPagePo(page);

        await configMapListPage.goTo();
        await configMapListPage.waitForPage();

        const table = configMapListPage.list().resourceTable().sortableTable();

        await expect(table.self()).toBeVisible();
        await table.checkLoadingIndicatorNotVisible();

        await expect(table.pagination()).toBeVisible();
        await expect(table.paginationText()).toContainText(`1 - 10 of ${MOCK_COUNT}`);

        // Page 1 nav button states
        await expect(table.paginationBeginButton()).toBeDisabled();
        await expect(table.paginationPrevButton()).toBeDisabled();
        await expect(table.paginationNextButton()).toBeEnabled();
        await expect(table.paginationEndButton()).toBeEnabled();

        // Navigate right → page 2
        await table.paginationNextButton().click();
        await expect(table.paginationText()).toContainText(`11 - 20 of ${MOCK_COUNT}`);
        await expect(table.paginationBeginButton()).toBeEnabled();

        // Navigate left → page 1
        await table.paginationPrevButton().click();
        await expect(table.paginationText()).toContainText(`1 - 10 of ${MOCK_COUNT}`);

        // Navigate to last page
        await table.paginationEndButton().click();
        await expect(table.paginationText()).toContainText(`21 - ${MOCK_COUNT} of ${MOCK_COUNT}`);

        // Navigate to first page
        await table.paginationBeginButton().click();
        await expect(table.paginationText()).toContainText(`1 - 10 of ${MOCK_COUNT}`);
      } finally {
        await restoreTablePreferences(rancherApi, savedPrefs);
      }
    });

    test('sorting changes the order of paginated configmaps data', async ({ page, login, rancherApi }) => {
      const savedPrefs = await setTablePreferences(rancherApi, []);

      try {
        await login();
        const configMapListPage = new ConfigMapsPagePo(page);

        await configMapListPage.goTo();
        await configMapListPage.waitForPage();

        const table = configMapListPage.list().resourceTable().sortableTable();

        await expect(table.self()).toBeVisible();
        await table.checkLoadingIndicatorNotVisible();

        // Click Namespace (col 2) first to clear any existing Name sort state
        await table.sort(2).click();
        await expect(table.sortIcon(2, 'down')).toBeVisible();

        // Now click Name (col 1) — first click always sets ASC
        await table.sort(1).click();
        await expect(table.sortIcon(1, 'down')).toBeVisible();

        // Click again to toggle to DESC
        await table.sort(1).click();
        await expect(table.sortIcon(1, 'up')).toBeVisible();
      } finally {
        await restoreTablePreferences(rancherApi, savedPrefs);
      }
    });

    test('filter configmaps', async ({ page, login, rancherApi }) => {
      const nsName = `e2e-cm-filter-${Date.now()}`;
      const cmName = `e2e-filter-target-${Date.now()}`;
      const cmName2 = `e2e-filter-other-${Date.now()}`;

      await rancherApi.createNamespace(nsName);

      try {
        await rancherApi.createConfigMap(nsName, cmName);
        await rancherApi.createConfigMap(nsName, cmName2);

        const savedPrefs = await setTablePreferences(rancherApi, [nsName]);

        try {
          await login();
          const configMapListPage = new ConfigMapsPagePo(page);

          await configMapListPage.goTo();
          await configMapListPage.waitForPage();

          const table = configMapListPage.list().resourceTable().sortableTable();

          await expect(table.self()).toBeVisible();
          await table.checkLoadingIndicatorNotVisible();

          // Filter by specific name
          await table.filter(cmName);
          await expect(table.rowElementWithName(cmName)).toBeVisible();

          // Reset filter restores list
          await table.resetFilter();
          await expect(table.rowElementWithName(cmName2)).toBeVisible();
        } finally {
          await restoreTablePreferences(rancherApi, savedPrefs);
        }
      } finally {
        await rancherApi.deleteNamespace([nsName]);
      }
    });
  });
});
