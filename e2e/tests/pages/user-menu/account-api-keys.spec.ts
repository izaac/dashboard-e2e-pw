import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';
import UserMenuPo from '@/e2e/po/side-bars/user-menu.po';
import AccountPagePo from '@/e2e/po/pages/account-api-keys.po';
import CreateKeyPagePo from '@/e2e/po/pages/account-api-keys-create_key.po';

// NOTE: The original Cypress spec was fully commented out / skipped due to
// https://github.com/rancher/dashboard/issues/12325
// This Playwright conversion mirrors the intended tests. Un-skip when the
// upstream issue is resolved.

test.describe('Account and API Keys', { tag: ['@userMenu', '@adminUser', '@standardUser'] }, () => {
  test.skip(true, 'Skipped pending resolution of https://github.com/rancher/dashboard/issues/12325');

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

  test('Can create and delete API keys', async ({ page, login }) => {
    await login();

    const accountPage = new AccountPagePo(page);
    const createKeyPage = new CreateKeyPagePo(page);

    await accountPage.goTo();
    await accountPage.waitForPage();

    // Create an API key
    await accountPage.create();
    await createKeyPage.waitForPage();
  });
});
