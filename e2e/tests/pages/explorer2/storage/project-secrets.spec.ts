import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';
import ResourceListMastheadPo from '@/e2e/po/components/resource-list-masthead.po';
import CreateEditViewPo from '@/e2e/po/components/create-edit-view.po';

test.describe('Project Secrets', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('has the correct title', async ({ page, rancherApi }) => {
    const projectSecretsPage = new PagePo(page, '/c/local/explorer/secret?mode=project');

    await projectSecretsPage.goTo();

    const masthead = new ResourceListMastheadPo(page, ':scope');

    await expect(masthead.title()).toContainText('Secret');

    const version = await rancherApi.getRancherVersion();
    const expectedTitle =
      version.RancherPrime === 'true' ? 'Rancher Prime - local - Project Secrets' : 'Rancher - local - Project Secrets';

    await expect(page).toHaveTitle(expectedTitle);
  });

  test('creates a project-scoped secret', async ({ page, rancherApi }) => {
    const projectSecretsPage = new PagePo(page, '/c/local/explorer/secret?mode=project');
    const secretName = `e2e-project-secret-${Date.now()}`;
    let secretNamespace = '';

    await projectSecretsPage.goTo();
    await projectSecretsPage.waitForPage();

    await page.getByTestId('secrets-list-create').or(page.getByTestId('masthead-create')).click();

    const basicAuthType = page.locator('.subtypes-container .subtype-banner').filter({ hasText: 'Basic Auth' });

    await basicAuthType.click();

    const cruResource = new CreateEditViewPo(page, '.dashboard-root');

    await cruResource.nameNsDescription().name().set(secretName);

    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/v1/secrets') && resp.request().method() === 'POST',
    );

    await cruResource.formSave().click();

    const response = await responsePromise;
    const body = await response.json();

    secretNamespace = body.metadata.namespace;

    try {
      expect(response.status()).toBe(201);
      expect(body.metadata.name).toBe(secretName);
    } finally {
      await rancherApi.deleteRancherResource('v1', `secrets/${secretNamespace}`, secretName, false);
    }
  });
});
