import { test, expect } from '@/support/fixtures';
import { WorkloadsDeploymentsListPagePo, WorkloadsDeploymentsCreatePagePo } from '@/e2e/po/pages/explorer/workloads/workloads-deployments.po';
import ResourceYamlPo from '@/e2e/po/components/resource-yaml.po';

const namespace = 'default';
const containerImage = 'nginx';

test.describe('Yaml Editor', () => {
  let name: string;

  test.beforeEach(async ({ page, login, rancherApi }) => {
    await login();

    name = rancherApi.createE2EResourceName('deployment');

    // Create a new deployment resource via UI
    const deploymentsCreatePage = new WorkloadsDeploymentsCreatePagePo(page, 'local');

    await deploymentsCreatePage.goTo();

    // Start listening BEFORE the action that triggers the response
    const createPromise = page.waitForResponse(
      (resp) => resp.url().includes('/v1/apps.deployments') && resp.request().method() === 'POST'
    );

    await deploymentsCreatePage.createWithUI(name, containerImage, namespace);

    const createResp = await createPromise;

    expect(createResp.status()).toBe(201);
  });

  test.describe('Edit mode', () => {
    test('Check if body and footer are visible to human eye', { tag: ['@components', '@adminUser'] }, async ({ page }) => {
      const deploymentsListPage = new WorkloadsDeploymentsListPagePo(page, 'local');

      await deploymentsListPage.goTo();
      await expect(deploymentsListPage.listElementWithName(name)).toBeAttached();
      await deploymentsListPage.goToEditYamlPage(name);

      const resourceYaml = new ResourceYamlPo(page);

      await expect(resourceYaml.body()).toBeVisible();
      await expect(resourceYaml.footer()).toBeVisible();
    });
  });

  test.afterEach(async ({ page }) => {
    // Delete the deployment
    const deploymentsListPage = new WorkloadsDeploymentsListPagePo(page, 'local');

    await deploymentsListPage.goTo();
    await deploymentsListPage.deleteItemWithUI(name);
  });
});
