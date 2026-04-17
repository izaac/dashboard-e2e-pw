import { test, expect } from '@/support/fixtures';
import { HomeLinksPagePo } from '@/e2e/po/pages/global-settings/home-links.po';
import HomePagePo from '@/e2e/po/pages/home.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';

const runTimestamp = Date.now();
const runPrefix = `e2e-test-${runTimestamp}`;

test.describe('Home Links', () => {
  let homeLinksPage: HomeLinksPagePo;
  let originalCustomLinks: any;

  test.beforeEach(async ({ login, page, rancherApi }) => {
    await login();
    const homePage = new HomePagePo(page);

    await homePage.goTo();
    homeLinksPage = new HomeLinksPagePo(page);

    // Save original custom links setting for cleanup
    const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-custom-links');

    originalCustomLinks = resp.body;
  });

  test.afterEach(async ({ rancherApi }) => {
    // Restore original custom links setting
    if (originalCustomLinks) {
      try {
        const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-custom-links');

        originalCustomLinks.metadata.resourceVersion = resp.body.metadata.resourceVersion;
        await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-custom-links', originalCustomLinks);
      } catch {
        // ignore cleanup errors
      }
    }
  });

  test('can hide or show default links on the Home Page', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, rancherApi }) => {
    const homePage = new HomePagePo(page);
    const burgerMenu = new BurgerMenuPo(page);
    const sideNav = new ProductNavPo(page);

    // Navigate to Home Links page
    await burgerMenu.toggle();
    await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
    await sideNav.navToSideMenuEntryByLabel('Home Links');

    // Hide all links
    const checkboxes = homeLinksPage.defaultLinkCheckboxes();

    for (let i = 0; i < 5; i++) {
      await checkboxes.nth(i).click();
    }

    // Apply and wait for response
    const applyResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('ui-custom-links') && resp.request().method() === 'PUT'
    );

    await homeLinksPage.saveButton().click();
    const applyResp = await applyResponsePromise;

    expect(applyResp.status()).toBe(200);

    await homePage.goTo();

    // "SUSE Application Collection" for Rancher Prime, otherwise "Commercial Support"
    const version = await rancherApi.getRancherVersion();
    const expectedValue = version.RancherPrime === 'true' ? 'SUSE Application Collection' : 'Commercial Support';
    const supportLinks = homeLinksPage.supportLinks();

    await expect(supportLinks).toHaveCount(1);
    await expect(supportLinks.first()).toContainText(expectedValue);

    // Navigate back to Home Links page
    await burgerMenu.toggle();
    await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
    await sideNav.navToSideMenuEntryByLabel('Home Links');

    // Show all links
    const checkboxes2 = homeLinksPage.defaultLinkCheckboxes();

    for (let i = 0; i < 5; i++) {
      await checkboxes2.nth(i).click();
    }

    const applyResponsePromise2 = page.waitForResponse(
      (resp) => resp.url().includes('ui-custom-links') && resp.request().method() === 'PUT'
    );

    await homeLinksPage.saveButton().click();
    await applyResponsePromise2;

    await homePage.goTo();
    await expect(homeLinksPage.supportLinks()).toHaveCount(6);
  });

  test('can add and remove custom links', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, rancherApi }) => {
    const burgerMenu = new BurgerMenuPo(page);
    const sideNav = new ProductNavPo(page);
    const customLinkName = `${runPrefix}-custom-link`;
    const customLinkUrl = `https://${runPrefix}/custom/link/url`;

    // Navigate to Home Links page
    await burgerMenu.toggle();
    await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
    await sideNav.navToSideMenuEntryByLabel('Home Links');

    // Add custom link
    await homeLinksPage.addLinkButton().click();
    await homeLinksPage.displayTextInput().set(customLinkName);
    await homeLinksPage.urlInput().set(customLinkUrl);

    // KeyValue component uses debounce(update, 500ms) — wait for it to propagate
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(600);

    // Save and wait for API response
    const saveResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('ui-custom-links') && resp.request().method() === 'PUT'
    );

    await homeLinksPage.saveButton().click();
    const saveResp = await saveResponsePromise;

    expect(saveResp.status()).toBe(200);

    // Full page reload to pick up the saved setting
    await page.goto('./home', { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    await expect(homeLinksPage.supportLinks().filter({ hasText: customLinkName })).toHaveAttribute('href', customLinkUrl);

    // Remove custom link
    await burgerMenu.toggle();
    await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
    await sideNav.navToSideMenuEntryByLabel('Home Links');

    await homeLinksPage.removeItemButton().click();
    await expect(homeLinksPage.displayTextInput().self()).not.toBeAttached();

    // KeyValue debounce(500ms) — wait for removal to propagate
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(600);

    const removeResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('ui-custom-links') && resp.request().method() === 'PUT'
    );

    await homeLinksPage.saveButton().click();
    await removeResponsePromise;

    await page.goto('./home', { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    await expect(homeLinksPage.supportLinks().filter({ hasText: customLinkName })).not.toBeAttached();
  });

  test('standard user has only read access to Home Links page', { tag: ['@globalSettings', '@standardUser'] }, async ({ page, login }) => {
    await login();
    const homePage = new HomePagePo(page);

    await homePage.goTo();

    const burgerMenu = new BurgerMenuPo(page);
    const sideNav = new ProductNavPo(page);

    // Navigate to Home Links page
    await burgerMenu.toggle();
    await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
    await sideNav.navToSideMenuEntryByLabel('Home Links');

    // verify action buttons/checkboxes are hidden for standard user
    await expect(homeLinksPage.defaultLinkCheckboxes().first()).not.toBeAttached();
    await expect(homeLinksPage.saveButton().self()).not.toBeAttached();
  });

  test('cleans custom links', { tag: ['@globalSettings', '@adminUser'] }, async ({ page }) => {
    const burgerMenu = new BurgerMenuPo(page);
    const sideNav = new ProductNavPo(page);
    const customLinkName = `${runPrefix}-custom-link2`;
    const customLinkUrl = 'javascript:window.alert(window)';

    // Navigate to Home Links page
    await burgerMenu.toggle();
    await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
    await sideNav.navToSideMenuEntryByLabel('Home Links');

    // Add custom link with javascript: URL
    await homeLinksPage.addLinkButton().click();
    await homeLinksPage.displayTextInput().set(customLinkName);
    await homeLinksPage.urlInput().set(customLinkUrl);

    // KeyValue component uses debounce(update, 500ms) — wait for it to propagate
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(600);

    // Save and wait for API response
    const saveResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('ui-custom-links') && resp.request().method() === 'PUT'
    );

    await homeLinksPage.saveButton().click();
    const saveResp = await saveResponsePromise;

    expect(saveResp.status()).toBe(200);

    // Full page reload to pick up saved setting
    await page.goto('./home', { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');

    // The javascript: link should be sanitized
    const link = homeLinksPage.supportLinks().filter({ hasText: customLinkName });

    await expect(link).not.toHaveAttribute('href', customLinkUrl);
    const href = await link.getAttribute('href');

    expect(href).toMatch(/#$/);

    // Remove custom link
    await burgerMenu.toggle();
    await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
    await sideNav.navToSideMenuEntryByLabel('Home Links');

    await homeLinksPage.removeItemButton().click();
    await expect(homeLinksPage.displayTextInput().self()).not.toBeAttached();

    // KeyValue debounce(500ms) — wait for removal to propagate
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(600);

    const removeResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('ui-custom-links') && resp.request().method() === 'PUT'
    );

    await homeLinksPage.saveButton().click();
    await removeResponsePromise;

    await page.goto('./home', { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    await expect(homeLinksPage.supportLinks().filter({ hasText: customLinkName })).not.toBeAttached();
  });
});
