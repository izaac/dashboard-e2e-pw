import { test, expect } from '@/support/fixtures';
import { ConfigMapsListPagePo } from '@/e2e/po/pages/explorer/storage/configmaps.po';

test.describe('ConfigMap', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('has the correct title', async ({ page, rancherApi }) => {
    const configMapListPage = new ConfigMapsListPagePo(page);

    await configMapListPage.goTo();

    await expect(configMapListPage.masthead().title()).toContainText('ConfigMaps');

    const version = await rancherApi.getRancherVersion();
    const expectedTitle =
      version.RancherPrime === 'true' ? 'Rancher Prime - local - ConfigMaps' : 'Rancher - local - ConfigMaps';

    await expect(page).toHaveTitle(expectedTitle);
  });

  test('creates a configmap and displays it in the list', async ({ page, rancherApi }) => {
    const configMapName = `e2e-test-${Date.now()}-custom-config-map`;
    const namespace = 'default';

    const configMapListPage = new ConfigMapsListPagePo(page);

    await configMapListPage.goTo();
    await configMapListPage.waitForPage();

    await configMapListPage.masthead().create();

    const cruResource = configMapListPage.createEditView();

    await cruResource.nameNsDescription().name().set(configMapName);

    await cruResource.keyInput(0).first().fill('managerApiConfiguration.properties');
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

      await configMapListPage.filterBySearchBox(configMapName);
      await expect(configMapListPage.sortableTable().rowElements()).toHaveCount(1);
    } finally {
      await rancherApi.deleteRancherResource('v1', `configmaps/${namespace}`, configMapName, false);
    }
  });

  test('should show an error banner if the api call sends back an error', async ({ page }) => {
    const configMapListPage = new ConfigMapsListPagePo(page);

    await configMapListPage.goTo();
    await configMapListPage.waitForPage();

    await configMapListPage.masthead().create();

    const cruResource = configMapListPage.createEditView();

    await cruResource.nameNsDescription().name().set('$^$^"£%');
    await cruResource.formSave().click();

    await expect(cruResource.errorBanner()).toBeVisible();
  });

  test.describe('List', { tag: ['@noVai', '@adminUser'] }, () => {
    test.skip(true, 'Pagination tests require bulk resource creation infrastructure (createManyNamespacedResources)');

    test('pagination is visible and user is able to navigate through configmaps data', async () => {});
    test('sorting changes the order of paginated configmaps data', async () => {});
    test('filter configmaps', async () => {});
  });
});
