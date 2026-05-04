import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';

test.describe('Page Actions', { tag: ['@navigation', '@adminUser', '@standardUser'] }, () => {
  test.beforeEach(async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();
  });

  test('Can open page actions menu and see available options', async ({ page }) => {
    const homePage = new HomePagePo(page);

    await expect(homePage.pageActionsButton()).toBeVisible();
    await homePage.pageActionsButton().click();

    // Home page actions include "Set as login page" and "Show/Hide Banner"
    await expect(homePage.pageActionsMenuItem('Set as login page')).toBeVisible();
    await expect(homePage.pageActionsMenuItem('Show/Hide Banner')).toBeVisible();
  });

  test('Page actions menu closes when clicking away', async ({ page }) => {
    const homePage = new HomePagePo(page);

    await homePage.pageActionsButton().click();
    await expect(homePage.pageActionsMenuItem('Set as login page')).toBeVisible();

    // Press Escape to close the menu — semantic and viewport-independent
    // (the previous fixed-position click would land in different DOM regions
    // depending on browser size, and could itself activate a different menu).
    await page.keyboard.press('Escape');
    await expect(homePage.pageActionsMenuItem('Set as login page')).toBeHidden();
  });
});
