import { test, expect } from '@/support/fixtures';
import { BrandingPagePo } from '@/e2e/po/pages/global-settings/branding.po';
import { SettingsPagePo } from '@/e2e/po/pages/global-settings/settings.po';
import HomePagePo from '@/e2e/po/pages/home.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';

const settings = {
  privateLabel: {
    original: 'Rancher',
    new:      'Rancher e2e',
  },
  primaryColor: {
    original:     '#3d98d3',
    new:          '#f80dd8',
    newRGB:       'rgb(248, 13, 216)',
    validNewRGBs: ['rgb(248, 13, 216)', 'rgb(249, 63, 224)'],
  },
  linkColor: {
    original: '#3d98d3',
    new:      '#ddd603',
    newRGB:   'rgb(221, 214, 3)',
  },
};

test.describe('Branding', () => {
  test.beforeEach(async ({ login, page }) => {
    await login();
    const homePage = new HomePagePo(page);

    await homePage.goTo();
  });

  async function navToBranding(page: any) {
    const burgerMenu = new BurgerMenuPo(page);
    const sideNav = new ProductNavPo(page);

    await burgerMenu.toggle();
    await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
    await sideNav.navToSideMenuEntryByLabel('Branding');
  }

  test('Can navigate to Branding Page', { tag: ['@globalSettings', '@adminUser', '@standardUser'] }, async ({ page }) => {
    const burgerMenu = new BurgerMenuPo(page);
    const sideNav = new ProductNavPo(page);

    await burgerMenu.toggle();

    const globalSettingsNavItem = burgerMenu.links().filter({ hasText: 'Global Settings' });

    await expect(globalSettingsNavItem).toBeAttached();
    await globalSettingsNavItem.click();

    const settingsPage = new SettingsPagePo(page, '_');

    await settingsPage.waitForPageWithClusterId();

    // check if burger menu nav is highlighted correctly for Global Settings
    await burgerMenu.checkIfMenuItemLinkIsHighlighted('Global Settings');

    // catching regression https://github.com/rancher/dashboard/issues/10576
    await burgerMenu.checkIfClusterMenuLinkIsHighlighted('local', false);

    const brandingNavItem = await sideNav.sideMenuEntryByLabel('Branding');

    await expect(brandingNavItem).toBeAttached();
    await brandingNavItem.click();

    const brandingPage = new BrandingPagePo(page);

    await brandingPage.waitForPageWithClusterId();
  });

  test('Private Label', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, rancherApi }) => {
    const brandingPage = new BrandingPagePo(page);
    const homePage = new HomePagePo(page);
    const burgerMenu = new BurgerMenuPo(page);

    await navToBranding(page);

    // Set
    await expect(page).not.toHaveTitle(settings.privateLabel.new);
    await brandingPage.privateLabel().set(settings.privateLabel.new);

    // Apply
    const applyResponsePromise = page.waitForResponse(
      (resp: any) => resp.url().includes('ui-pl') && resp.request().method() === 'PUT'
    );

    await brandingPage.saveButton().click();
    await applyResponsePromise;

    // Visit the Home Page
    await burgerMenu.toggle();
    await burgerMenu.home().click();

    await expect(homePage.title()).toHaveText(`Welcome to ${settings.privateLabel.new}`);

    // Check in session
    await expect(page).toHaveTitle(`${settings.privateLabel.new} - Homepage`);

    // Check over reload
    await page.reload();
    await expect(page).toHaveTitle(new RegExp(`${settings.privateLabel.new}`));

    await navToBranding(page);

    // Reset
    await brandingPage.privateLabel().set(settings.privateLabel.original);
    const resetResponsePromise = page.waitForResponse(
      (resp: any) => resp.url().includes('ui-pl') && resp.request().method() === 'PUT'
    );

    await brandingPage.saveButton().click();
    await resetResponsePromise;

    await burgerMenu.toggle();
    await burgerMenu.home().click();
    await expect(page).toHaveTitle(new RegExp(`${settings.privateLabel.original} - Homepage`), { timeout: 5000 });

    // Also reset via API in case UI test failed partway
    try {
      const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-pl');
      const resourceVersion = resp.body.metadata.resourceVersion;

      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-pl', {
        value:    settings.privateLabel.original.toLowerCase(),
        metadata: { name: 'ui-pl', resourceVersion },
      });
    } catch {
      // ignore cleanup errors
    }
  });

  test('standard user has only read access to Branding page', { tag: ['@globalSettings', '@standardUser'] }, async ({ page, login }) => {
    test.skip(true, 'Requires standard user credentials — no standard user provisioned in test environment');
    await login();
    const homePage = new HomePagePo(page);

    await homePage.goTo();

    const brandingPage = new BrandingPagePo(page);

    await navToBranding(page);

    // verify action buttons/checkboxes etc. are disabled/hidden for standard user
    await expect(brandingPage.privateLabel().self()).toBeDisabled();
    await expect(brandingPage.saveButton().self()).not.toBeAttached();
  });
});
