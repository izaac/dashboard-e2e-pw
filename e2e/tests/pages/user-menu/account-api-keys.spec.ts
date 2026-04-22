import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';
import UserMenuPo from '@/e2e/po/side-bars/user-menu.po';
import AccountPagePo from '@/e2e/po/pages/account-api-keys.po';
import CreateKeyPagePo from '@/e2e/po/pages/account-api-keys-create_key.po';

test.describe('Account and API Keys', { tag: ['@userMenu', '@adminUser', '@standardUser'] }, () => {
  test('Can navigate to Account and API Keys page', async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);
    const userMenu = new UserMenuPo(page);
    const accountPage = new AccountPagePo(page);

    await homePage.goTo();
    await homePage.waitForPage();

    await userMenu.clickMenuItem('Account & API Keys');
    await accountPage.waitForPage();
    await accountPage.checkIsCurrentPage();
    await accountPage.title();
  });

  test('Can create API keys', async ({ page, login, rancherApi }) => {
    await login();

    const accountPage = new AccountPagePo(page);
    const createKeyPage = new CreateKeyPagePo(page);
    const apiKeysList = accountPage.list();
    const keyDesc = `e2e-api-key-${Date.now()}`;
    let createdKeyId = '';

    try {
      await accountPage.goTo();
      await accountPage.waitForPage();

      await accountPage.create();
      await createKeyPage.waitForPage();
      await createKeyPage.checkIsCurrentPage();
      await createKeyPage.description().set(keyDesc);

      const createResponse = page.waitForResponse(
        (resp) => resp.url().includes('/v3/tokens') && resp.request().method() === 'POST',
      );

      await createKeyPage.create();
      const resp = await createResponse;

      expect(resp.status()).toBe(201);
      const body = await resp.json();

      createdKeyId = body.id;

      const accessKey = (await createKeyPage.apiAccessKey().textContent()) ?? '';

      expect(accessKey.length).toBeGreaterThan(0);
      await createKeyPage.done();

      // Filter table to find our key (table may be paginated)
      await apiKeysList.checkVisible();
      const sortableTable = apiKeysList.resourceTable().sortableTable();

      await sortableTable.filter(keyDesc);

      const keyRow = apiKeysList.rowWithName(accessKey.trim());

      await expect(keyRow.self()).toBeVisible();
      await expect(apiKeysList.details(accessKey.trim(), 3)).toContainText(keyDesc);
    } finally {
      if (createdKeyId) {
        await rancherApi.deleteRancherResource('v3', 'tokens', createdKeyId, false);
      }
    }
  });
});
