import { test, expect } from '@/support/fixtures';
import { SecretsListPagePo } from '@/e2e/po/pages/explorer/secrets.po';

test.describe('Secrets', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('has the correct title', async ({ page, rancherApi }) => {
    const secretsListPage = new SecretsListPagePo(page, 'local');

    await secretsListPage.goTo();
    await expect(secretsListPage.title()).toContainText('Secrets');

    const version = await rancherApi.getRancherVersion();
    const expectedTitle =
      version.RancherPrime === 'true' ? 'Rancher Prime - local - Secrets' : 'Rancher - local - Secrets';

    await expect(page).toHaveTitle(expectedTitle);
  });

  test('displays the list of secrets and has a create button', async ({ page }) => {
    const secretsListPage = new SecretsListPagePo(page, 'local');

    await secretsListPage.goTo();
    await secretsListPage.waitForPage();

    await expect(secretsListPage.createButtonTitle()).toContainText('Create');
    await expect(secretsListPage.list().self()).toBeVisible();
  });

  // https://github.com/rancher/dashboard/issues/14773
  // eslint-disable-next-line playwright/expect-expect -- stub body never runs
  test.skip('creates a project-scoped secret and displays it in the list', () => {});
});
