import { test, expect } from '@/support/fixtures';
import { BannersPagePo } from '@/e2e/po/pages/global-settings/banners.po';
import { SettingsPagePo } from '@/e2e/po/pages/global-settings/settings.po';
import HomePagePo from '@/e2e/po/pages/home.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';

const settings = {
  bannerLabel:          'Rancher e2e',
  bannerLabelMultiline: 'Rancher e2e\nTwo',
  textAlignment:        {
    original: 'Center',
    new:      'Right',
  },
  fontSize: {
    original: '14px',
    new:      '20px',
  },
  fontWeight:     '700',
  fontStyle:      'italic',
  textDecoration: 'Underline',
  height:         {
    single:    '40px',
    multiline: '80px',
  },
  bannerTextColor: {
    original: '#141419',
    new:      '#f80dd8',
    newRGB:   'rgb(248, 13, 216)',
  },
  bannerBackgroundColor: {
    original: '#EEEFF4',
    new:      '#ddd603',
    newRGB:   'rgb(221, 214, 3)',
  },
};

test.describe('Banners', () => {
  let bannersPage: BannersPagePo;

  test.beforeEach(async ({ login, page }) => {
    await login();
    const homePage = new HomePagePo(page);

    await homePage.goTo();
    bannersPage = new BannersPagePo(page);
  });

  test.afterEach(async ({ rancherApi }) => {
    // Clean up all banner settings to ensure idempotency
    try {
      const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banners');
      const banners = resp.body;
      const value = JSON.parse(banners.value || '{}');

      value.showHeader = 'false';
      value.showFooter = 'false';
      value.showConsent = 'false';
      banners.value = JSON.stringify(value);
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banners', banners);

      // Clear individual banner settings
      for (const setting of ['ui-banner-header', 'ui-banner-footer', 'ui-banner-login-consent']) {
        const indResp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', setting);

        if (indResp.body.value) {
          indResp.body.value = '';
          await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', setting, indResp.body);
        }
      }
    } catch {
      // ignore cleanup errors
    }
  });

  test.describe('Standard Banner Configuration', () => {
    test('can navigate to Banners Page', { tag: ['@globalSettings', '@adminUser', '@standardUser'] }, async ({ page }) => {
      const burgerMenu = new BurgerMenuPo(page);
      const sideNav = new ProductNavPo(page);

      await burgerMenu.toggle();

      await expect(burgerMenu.categories().filter({ hasText: 'Configuration' })).toBeAttached();
      const globalSettingsNavItem = burgerMenu.links().filter({ hasText: 'Global Settings' });

      await expect(globalSettingsNavItem).toBeAttached();
      await globalSettingsNavItem.click();

      const settingsPage = new SettingsPagePo(page, '_');

      await settingsPage.waitForPageWithClusterId();

      const bannersNavItem = await sideNav.sideMenuEntryByLabel('Banners');

      await expect(bannersNavItem).toBeAttached();
      await bannersNavItem.click();

      await bannersPage.waitForPageWithClusterId();
    });

    test('standard user has only read access to Banner page', { tag: ['@globalSettings', '@standardUser'] }, async ({ page, login }) => {
      test.skip(true, 'Requires standard user credentials — no standard user provisioned in test environment');
      await login();
      const homePage = new HomePagePo(page);

      await homePage.goTo();

      const burgerMenu = new BurgerMenuPo(page);
      const sideNav = new ProductNavPo(page);

      await burgerMenu.toggle();
      await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
      await sideNav.navToSideMenuEntryByLabel('Banners');

      // verify action buttons/checkboxes etc. are disabled/hidden for standard user
      await expect(bannersPage.headerBannerCheckbox().self()).toBeDisabled();
      await expect(bannersPage.saveButton().self()).not.toBeAttached();
    });
  });

  test.describe('Header Banner (Individual Setting)', () => {
    test.beforeEach(async ({ rancherApi }) => {
      // Make sure banner is not shown from the ui-banners setting
      const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banners');
      const banners = resp.body;
      const value = JSON.parse(banners.value || '{}');

      value.showHeader = 'false';
      banners.value = JSON.stringify(value);
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banners', banners);

      // Also clear the individual header banner setting (may be left over from a prior run)
      const indResp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-header');

      if (indResp.body.value) {
        indResp.body.value = '';
        await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-header', indResp.body);
      }
    });

    test('Should not have banner', { tag: ['@globalSettings', '@adminUser'] }, async ({ page }) => {
      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await expect(bannersPage.headerBanner()).not.toBeAttached();
    });

    test('Should use banner from ui-banners setting', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, rancherApi }) => {
      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await expect(bannersPage.headerBanner()).not.toBeAttached();

      // Update the ui-banners setting to enable the banner
      let resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banners');
      let banners = resp.body;
      let value = JSON.parse(banners.value || '{}');

      value.showHeader = 'true';
      value.bannerHeader = value.bannerHeader || {};
      value.bannerHeader.text = 'TEST Banner (ui-banners)';
      value.bannerHeader.background = '#00ff00';
      banners.value = JSON.stringify(value);
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banners', banners);

      await homePage.goTo();
      const banner = bannersPage.headerBanner();

      await expect(banner).toBeAttached();
      await expect(banner).toContainText('TEST Banner (ui-banners)');

      await expect(bannersPage.headerBannerContent()).toHaveCSS('background-color', 'rgb(0, 255, 0)');

      // Turn off the banner
      resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banners');
      banners = resp.body;
      value = JSON.parse(banners.value || '{}');
      value.showHeader = 'false';
      banners.value = JSON.stringify(value);
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banners', banners);

      await homePage.goTo();
      await expect(bannersPage.headerBanner()).not.toBeAttached();
    });

    test('Should use banner from individual setting', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, rancherApi }) => {
      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await expect(bannersPage.headerBanner()).not.toBeAttached();

      // Set the banner via the individual setting
      const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-header');
      const banner = resp.body;

      banner.value = JSON.stringify({ text: 'Test Banner (individual setting)', background: '#ff0000' });
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-header', banner);

      await homePage.goTo();
      const bannerEl = bannersPage.headerBanner();

      await expect(bannerEl).toBeAttached();
      await expect(bannerEl).toContainText('Test Banner (individual setting)');

      await expect(bannersPage.headerBannerContent()).toHaveCSS('background-color', 'rgb(255, 0, 0)');

      // Unset the individual banner
      const resp2 = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-header');

      resp2.body.value = '';
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-header', resp2.body);

      await homePage.goTo();
      await expect(bannersPage.headerBanner()).not.toBeAttached();
    });

    test('Should prefer setting from individual setting', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, rancherApi }) => {
      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await expect(bannersPage.headerBanner()).not.toBeAttached();

      // Update the ui-banners setting to enable the banner
      let resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banners');
      let banners = resp.body;
      let value = JSON.parse(banners.value || '{}');

      value.showHeader = 'true';
      value.bannerHeader = value.bannerHeader || {};
      value.bannerHeader.text = 'TEST Banner (ui-banners)';
      value.bannerHeader.background = '#00ff00';
      banners.value = JSON.stringify(value);
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banners', banners);

      await homePage.goTo();
      await expect(bannersPage.headerBanner()).toContainText('TEST Banner (ui-banners)');

      // Set the banner via the individual setting
      const indResp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-header');

      indResp.body.value = JSON.stringify({ text: 'Test Banner (individual setting)', background: '#ff0000' });
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-header', indResp.body);

      await homePage.goTo();
      await expect(bannersPage.headerBanner()).toContainText('Test Banner (individual setting)');

      await expect(bannersPage.headerBannerContent()).toHaveCSS('background-color', 'rgb(255, 0, 0)');

      // Turn off the banner via the banners setting
      resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banners');
      banners = resp.body;
      value = JSON.parse(banners.value || '{}');
      value.showHeader = 'false';
      banners.value = JSON.stringify(value);
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banners', banners);

      // Banner should still exist from the individual setting
      await homePage.goTo();
      await expect(bannersPage.headerBanner()).toContainText('Test Banner (individual setting)');

      // Unset the individual banner
      const indResp2 = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-header');

      indResp2.body.value = '';
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-header', indResp2.body);

      await homePage.goTo();
      await expect(bannersPage.headerBanner()).not.toBeAttached();
    });
  });

  test.describe('Footer Banner (Individual Setting)', () => {
    test.beforeEach(async ({ rancherApi }) => {
      const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banners');
      const banners = resp.body;
      const value = JSON.parse(banners.value || '{}');

      value.showFooter = 'false';
      banners.value = JSON.stringify(value);
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banners', banners);

      // Also clear the individual footer banner setting (may be left over from a prior run)
      const indResp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-footer');

      if (indResp.body.value) {
        indResp.body.value = '';
        await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-footer', indResp.body);
      }
    });

    test('Should not have banner', { tag: ['@globalSettings', '@adminUser'] }, async ({ page }) => {
      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await expect(bannersPage.footerBanner()).not.toBeAttached();
    });

    test('Should use banner from ui-banners setting', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, rancherApi }) => {
      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await expect(bannersPage.footerBanner()).not.toBeAttached();

      let resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banners');
      let banners = resp.body;
      let value = JSON.parse(banners.value || '{}');

      value.showFooter = 'true';
      value.bannerFooter = value.bannerFooter || {};
      value.bannerFooter.text = 'TEST Banner (ui-banners)';
      value.bannerFooter.background = '#00ff00';
      banners.value = JSON.stringify(value);
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banners', banners);

      await homePage.goTo();
      const banner = bannersPage.footerBanner();

      await expect(banner).toBeAttached();
      await expect(banner).toContainText('TEST Banner (ui-banners)');

      await expect(bannersPage.footerBannerContent()).toHaveCSS('background-color', 'rgb(0, 255, 0)');

      // Turn off the banner
      resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banners');
      banners = resp.body;
      value = JSON.parse(banners.value || '{}');
      value.showFooter = 'false';
      banners.value = JSON.stringify(value);
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banners', banners);

      await homePage.goTo();
      await expect(bannersPage.footerBanner()).not.toBeAttached();
    });

    test('Should use banner from individual setting', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, rancherApi }) => {
      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await expect(bannersPage.footerBanner()).not.toBeAttached();

      const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-footer');

      resp.body.value = JSON.stringify({ text: 'Test Banner (individual setting)', background: '#ff0000' });
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-footer', resp.body);

      await homePage.goTo();
      const banner = bannersPage.footerBanner();

      await expect(banner).toBeAttached();
      await expect(banner).toContainText('Test Banner (individual setting)');

      await expect(bannersPage.footerBannerContent()).toHaveCSS('background-color', 'rgb(255, 0, 0)');

      // Unset the individual banner
      const resp2 = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-footer');

      resp2.body.value = '';
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-footer', resp2.body);

      await homePage.goTo();
      await expect(bannersPage.footerBanner()).not.toBeAttached();
    });

    test('Should prefer setting from individual setting', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, rancherApi }) => {
      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await expect(bannersPage.footerBanner()).not.toBeAttached();

      // Enable via ui-banners
      let resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banners');
      let banners = resp.body;
      let value = JSON.parse(banners.value || '{}');

      value.showFooter = 'true';
      value.bannerFooter = value.bannerFooter || {};
      value.bannerFooter.text = 'TEST Banner (ui-banners)';
      value.bannerFooter.background = '#00ff00';
      banners.value = JSON.stringify(value);
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banners', banners);

      await homePage.goTo();
      await expect(bannersPage.footerBanner()).toContainText('TEST Banner (ui-banners)');

      // Set individual setting
      const indResp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-footer');

      indResp.body.value = JSON.stringify({ text: 'Test Banner (individual setting)', background: '#ff0000' });
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-footer', indResp.body);

      await homePage.goTo();
      await expect(bannersPage.footerBanner()).toContainText('Test Banner (individual setting)');

      // Turn off via banners setting
      resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banners');
      banners = resp.body;
      value = JSON.parse(banners.value || '{}');
      value.showFooter = 'false';
      banners.value = JSON.stringify(value);
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banners', banners);

      // Banner should still exist from the individual setting
      await homePage.goTo();
      await expect(bannersPage.footerBanner()).toContainText('Test Banner (individual setting)');

      // Unset the individual banner
      const indResp2 = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-footer');

      indResp2.body.value = '';
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-footer', indResp2.body);

      await homePage.goTo();
      await expect(bannersPage.footerBanner()).not.toBeAttached();
    });
  });

  test.describe('Login Consent Banner (Individual Setting)', () => {
    test.beforeEach(async ({ rancherApi }) => {
      const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banners');
      const banners = resp.body;
      const value = JSON.parse(banners.value || '{}');

      value.showConsent = 'false';
      banners.value = JSON.stringify(value);
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banners', banners);

      // Also clear the individual consent banner setting (may be left over from a prior run)
      const indResp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-login-consent');

      if (indResp.body.value) {
        indResp.body.value = '';
        await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-login-consent', indResp.body);
      }
    });

    test('Should not have banner', { tag: ['@globalSettings', '@adminUser'] }, async ({ page }) => {
      // Go to login page
      await page.goto('./auth/login', { waitUntil: 'domcontentloaded' });
      await expect(bannersPage.loginSubmitButton()).toBeVisible();
      await expect(bannersPage.consentBanner()).not.toBeAttached();
    });

    test('Should use banner from individual setting', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, rancherApi, login }) => {
      // Set the banner via the individual setting
      const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-login-consent');

      resp.body.value = JSON.stringify({ text: 'Test Banner (individual setting)', background: '#ff0000' });
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-login-consent', resp.body);

      await page.goto('./auth/login', { waitUntil: 'domcontentloaded' });

      const banner = bannersPage.consentBanner();

      await expect(banner).toBeAttached();
      await expect(banner).toContainText('Test Banner (individual setting)');

      await expect(bannersPage.consentBannerContent()).toHaveCSS('background-color', 'rgb(255, 0, 0)');

      // Unset the individual setting
      await login();
      const resp2 = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-login-consent');

      resp2.body.value = '';
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-login-consent', resp2.body);
    });

    test('Should prefer banner from individual setting', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, rancherApi, login }) => {
      // Set the banner via the individual setting
      const indResp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-login-consent');

      indResp.body.value = JSON.stringify({ text: 'Test Banner (individual setting)', background: '#ff0000' });
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-login-consent', indResp.body);

      // Also enable via ui-banners
      let resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banners');
      let banners = resp.body;
      let value = JSON.parse(banners.value || '{}');

      value.showConsent = 'true';
      value.bannerConsent = value.bannerConsent || {};
      value.bannerConsent.text = 'TEST Banner (ui-banners)';
      value.bannerConsent.background = '#00ff00';
      banners.value = JSON.stringify(value);
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banners', banners);

      // Back to the login screen - check the banner is using the individual setting
      await page.goto('./auth/login', { waitUntil: 'domcontentloaded' });
      await expect(bannersPage.loginSubmitButton()).toBeVisible();

      const banner = bannersPage.consentBanner();

      await expect(banner).toBeAttached();
      await expect(banner).toContainText('Test Banner (individual setting)');

      await expect(bannersPage.consentBannerContent()).toHaveCSS('background-color', 'rgb(255, 0, 0)');

      // Login again to clean up
      await login();

      // Unset individual setting
      const indResp2 = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-login-consent');

      indResp2.body.value = '';
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banner-login-consent', indResp2.body);

      // Turn off via banners setting
      resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banners');
      banners = resp.body;
      value = JSON.parse(banners.value || '{}');
      value.showConsent = 'false';
      banners.value = JSON.stringify(value);
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banners', banners);

      // Check no banners on login screen
      await page.goto('./auth/login', { waitUntil: 'domcontentloaded' });
      await expect(bannersPage.loginSubmitButton()).toBeVisible();
      await expect(banner).not.toBeAttached();
    });
  });
});
