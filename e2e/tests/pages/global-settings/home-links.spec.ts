import { test, expect } from '@/support/fixtures';
import { HomeLinksPagePo } from '@/e2e/po/pages/global-settings/home-links.po';
import HomePagePo from '@/e2e/po/pages/home.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';

const runTimestamp = Date.now();
const runPrefix = `e2e-test-${runTimestamp}`;

test.describe('Home Links', () => {
  // Serial: tests mutate the global `ui-custom-links` setting; parallel runs would race the snapshot/restore cycle.
  test.describe.configure({ mode: 'serial' });
  let homeLinksPage: HomeLinksPagePo;
  let originalCustomLinks: any;

  test.beforeEach(async ({ login, page, rancherApi }) => {
    await login();
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
        await rancherApi.setRancherResource(
          'v1',
          'management.cattle.io.settings',
          'ui-custom-links',
          originalCustomLinks,
        );
      } catch (err) {
        // Best-effort restore — log so genuine failures surface in CI rather than silently
        // leaking custom-links state into subsequent tests
        console.warn(`[home-links afterEach] restoring ui-custom-links failed: ${(err as Error)?.message ?? err}`);
      }
    }
  });

  test(
    'can hide or show default links on the Home Page',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      const homePage = new HomePagePo(page);
      const burgerMenu = new BurgerMenuPo(page);
      const sideNav = new ProductNavPo(page);

      // Navigate to Home Links page
      await burgerMenu.toggle();
      await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
      await sideNav.navToSideMenuEntryByLabel('Home Links');

      // Hide the first 5 default links — the test deliberately leaves the 6th
      // (Commercial Support / SUSE Application Collection) visible so the
      // toHaveCount(1) assertion below has a target. Do NOT derive the count
      // from `checkboxes.count()` — hiding all of them invalidates the test.
      const checkboxes = homeLinksPage.defaultLinkCheckboxes();

      for (let i = 0; i < 5; i++) {
        await checkboxes.nth(i).click();
      }

      // Apply and wait for response
      const applyResponsePromise = page.waitForResponse(
        (resp) => resp.url().includes('ui-custom-links') && resp.request().method() === 'PUT',
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
        (resp) => resp.url().includes('ui-custom-links') && resp.request().method() === 'PUT',
      );

      await homeLinksPage.saveButton().click();
      await applyResponsePromise2;

      await homePage.goTo();
      await expect(homeLinksPage.supportLinks()).toHaveCount(6);
    },
  );

  test('can add and remove custom links', { tag: ['@globalSettings', '@adminUser'] }, async ({ page }) => {
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

    await homeLinksPage.waitForKeyValueDebounce();

    // Save and wait for API response
    const saveResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('ui-custom-links') && resp.request().method() === 'PUT',
    );

    await homeLinksPage.saveButton().click();
    const saveResp = await saveResponsePromise;

    expect(saveResp.status()).toBe(200);

    // Full page reload to pick up the saved setting
    await page.goto('./home', { waitUntil: 'load' });
    await page.waitForLoadState('domcontentloaded');
    await expect(homeLinksPage.supportLinks().filter({ hasText: customLinkName })).toHaveAttribute(
      'href',
      customLinkUrl,
    );

    // Remove custom link
    await burgerMenu.toggle();
    await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
    await sideNav.navToSideMenuEntryByLabel('Home Links');

    await homeLinksPage.removeItemButton().click();
    await expect(homeLinksPage.displayTextInput().self()).not.toBeAttached();

    await homeLinksPage.waitForKeyValueDebounce();

    const removeResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('ui-custom-links') && resp.request().method() === 'PUT',
    );

    await homeLinksPage.saveButton().click();
    await removeResponsePromise;

    await page.goto('./home', { waitUntil: 'load' });
    await page.waitForLoadState('domcontentloaded');
    await expect(homeLinksPage.supportLinks().filter({ hasText: customLinkName })).not.toBeAttached();
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

    await homeLinksPage.waitForKeyValueDebounce();

    // Save and wait for API response
    const saveResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('ui-custom-links') && resp.request().method() === 'PUT',
    );

    await homeLinksPage.saveButton().click();
    const saveResp = await saveResponsePromise;

    expect(saveResp.status()).toBe(200);

    // Full page reload to pick up saved setting
    await page.goto('./home', { waitUntil: 'load' });
    await page.waitForLoadState('domcontentloaded');

    // The javascript: link should be sanitized
    const link = homeLinksPage.supportLinks().filter({ hasText: customLinkName });

    await expect(link).not.toHaveAttribute('href', customLinkUrl);
    await expect(link).toHaveAttribute('href', /#$/);

    // Remove custom link
    await burgerMenu.toggle();
    await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
    await sideNav.navToSideMenuEntryByLabel('Home Links');

    await homeLinksPage.removeItemButton().click();
    await expect(homeLinksPage.displayTextInput().self()).not.toBeAttached();

    await homeLinksPage.waitForKeyValueDebounce();

    const removeResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('ui-custom-links') && resp.request().method() === 'PUT',
    );

    await homeLinksPage.saveButton().click();
    await removeResponsePromise;

    await page.goto('./home', { waitUntil: 'load' });
    await page.waitForLoadState('domcontentloaded');
    await expect(homeLinksPage.supportLinks().filter({ hasText: customLinkName })).not.toBeAttached();
  });
});

test.describe('Home Links - Standard User', { tag: ['@globalSettings', '@standardUser'] }, () => {
  test('standard user has only read access to Home Links page', async ({ page, login, envMeta }) => {
    await login({ username: 'standard_user', password: envMeta.password });

    const homeLinksPage = new HomeLinksPagePo(page);
    const burgerMenu = new BurgerMenuPo(page);
    const sideNav = new ProductNavPo(page);

    await burgerMenu.toggle();
    await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
    await sideNav.navToSideMenuEntryByLabel('Home Links');

    await expect(homeLinksPage.defaultLinkCheckboxes().first()).not.toBeAttached();
    await expect(homeLinksPage.saveButton().self()).not.toBeAttached();
  });
});
