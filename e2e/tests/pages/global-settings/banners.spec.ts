import { test, expect } from '@/support/fixtures';
import { BannersPagePo } from '@/e2e/po/pages/global-settings/banners.po';
import { SettingsPagePo } from '@/e2e/po/pages/global-settings/settings.po';
import HomePagePo from '@/e2e/po/pages/home.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';
import UserMenuPo from '@/e2e/po/side-bars/user-menu.po';
import { LoginPagePo } from '@/e2e/po/pages/login-page.po';
import type { RancherApi } from '@/support/fixtures/rancher-api';

const settings = {
  bannerLabel: 'Rancher e2e',
  bannerLabelMultiline: 'Rancher e2e\nTwo',
  textAlignment: {
    original: 'Center',
    new: 'Right',
  },
  fontSize: {
    original: '14px',
    new: '20px',
  },
  fontWeight: '700',
  fontStyle: 'italic',
  textDecoration: 'Underline',
  height: {
    single: '40px',
    multiline: '80px',
  },
  bannerTextColor: {
    original: '#141419',
    new: '#f80dd8',
    newRGB: 'rgb(248, 13, 216)',
  },
  bannerBackgroundColor: {
    original: '#EEEFF4',
    new: '#ddd603',
    newRGB: 'rgb(221, 214, 3)',
  },
};

const bannerHtml =
  '<div style="display: flex; align-items: center; padding: 0 10px"><img onload="alert(\'hello\');" src="https://www.rancher.com/assets/img/logos/rancher-logo-horiz-color.svg" height="24" style="margin-right: 10px; padding: 4px 0"/><p>Use of this system implies acceptance of <a target="_blank" href="https://www.suse.com">SUSE\'s Terms and Conditions</a></p></div>';

const acceptButtonText = 'Got it!';

/**
 * Reset all banner settings to defaults via API.
 */
async function resetBannerSettings(rancherApi: RancherApi): Promise<void> {
  try {
    const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banners');
    const banners = resp.body;
    const value = JSON.parse(banners.value || '{}');

    value.showHeader = 'false';
    value.showFooter = 'false';
    value.showConsent = 'false';
    value.loginError = { showMessage: 'false', message: '' };
    value.bannerHeader = {};
    value.bannerFooter = {};
    value.bannerConsent = {};
    banners.value = JSON.stringify(value);
    await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banners', banners);

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
}

test.describe('Banners', () => {
  test.afterEach(async ({ rancherApi }) => {
    await resetBannerSettings(rancherApi);
  });

  test.describe('Standard Banner Configuration', () => {
    let bannersPage: BannersPagePo;

    test.beforeEach(async ({ login, page }) => {
      await login();
      bannersPage = new BannersPagePo(page);
    });

    test('can navigate to Banners Page', { tag: ['@globalSettings', '@adminUser'] }, async ({ page }) => {
      const homePage = new HomePagePo(page);

      await homePage.goTo();

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

    test('can show and hide Header Banner', { tag: ['@globalSettings', '@adminUser'] }, async ({ page }) => {
      await bannersPage.goTo();
      await bannersPage.waitForPageWithClusterId();

      // Show banner
      await bannersPage.headerBannerCheckbox().set();
      await bannersPage.headerBannerCheckbox().hasAppropriateWidth();
      await bannersPage.headerBannerCheckbox().hasAppropriateHeight();
      await bannersPage.headerTextArea().fill(settings.bannerLabelMultiline);
      await bannersPage.textAlignmentRadioGroup('bannerHeader').set(2);
      await bannersPage.textDecorationCheckbox('bannerHeader', 'Bold').set();
      await bannersPage.textDecorationCheckbox('bannerHeader', 'Italic').set();
      await bannersPage.textDecorationCheckbox('bannerHeader', 'Underline').set();
      await bannersPage.selectFontSizeByValue('bannerHeader', settings.fontSize.new);

      const textColor0 = await bannersPage.textColorPicker(0).value();

      expect(textColor0).not.toBe(settings.bannerTextColor.new.toLowerCase());
      await bannersPage.textColorPicker(0).set(settings.bannerTextColor.new);

      const bgColor1 = await bannersPage.textColorPicker(1).value();

      expect(bgColor1).not.toBe(settings.bannerBackgroundColor.new.toLowerCase());
      await bannersPage.textColorPicker(1).set(settings.bannerBackgroundColor.new);

      await bannersPage.applyAndWait('ui-banners', 200);

      // Check banner in session
      const banner = bannersPage.fixedBanner();

      await expect(banner).toBeVisible();
      await expect(banner).toHaveCSS('background-color', settings.bannerBackgroundColor.newRGB);
      await expect(banner).toHaveCSS('text-align', settings.textAlignment.new.toLowerCase());

      const innerDiv = bannersPage.fixedBannerTextDiv();

      await expect(innerDiv).toHaveCSS('color', settings.bannerTextColor.newRGB);
      await expect(innerDiv).toHaveCSS('font-weight', settings.fontWeight);
      await expect(innerDiv).toHaveCSS('font-style', settings.fontStyle);
      await expect(innerDiv).toHaveCSS('font-size', settings.fontSize.new);

      await bannersPage.headerBannerCheckbox().isChecked();
      await bannersPage.textAlignmentRadioGroup('bannerHeader').isChecked(2);
      expect(await bannersPage.textColorPicker(0).previewColor()).toBe(settings.bannerTextColor.newRGB);
      expect(await bannersPage.textColorPicker(1).previewColor()).toBe(settings.bannerBackgroundColor.newRGB);

      // Check over reload
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(banner).toBeVisible();
      await expect(banner).toHaveCSS('background-color', settings.bannerBackgroundColor.newRGB);
      await expect(banner).toHaveCSS('text-align', settings.textAlignment.new.toLowerCase());

      const innerDivReload = bannersPage.fixedBannerTextDiv();

      await expect(innerDivReload).toHaveCSS('color', settings.bannerTextColor.newRGB);
      await expect(innerDivReload).toHaveCSS('font-weight', settings.fontWeight);
      await expect(innerDivReload).toHaveCSS('font-style', settings.fontStyle);
      await expect(innerDivReload).toHaveCSS('font-size', settings.fontSize.new);

      await bannersPage.headerBannerCheckbox().isChecked();
      await bannersPage.textAlignmentRadioGroup('bannerHeader').isChecked(2);
      expect(await bannersPage.textColorPicker(0).previewColor()).toBe(settings.bannerTextColor.newRGB);
      expect(await bannersPage.textColorPicker(1).previewColor()).toBe(settings.bannerBackgroundColor.newRGB);

      // Hide banner
      await bannersPage.headerBannerCheckbox().set();
      await bannersPage.applyAndWait('ui-banners', 200);
      await expect(bannersPage.fixedBanner()).not.toBeAttached();
    });

    test('can show and hide Footer Banner', { tag: ['@globalSettings', '@adminUser'] }, async ({ page }) => {
      await bannersPage.goTo();
      await bannersPage.waitForPageWithClusterId();

      // Show banner
      await bannersPage.footerBannerCheckbox().set();
      await bannersPage.footerTextArea().fill(settings.bannerLabel);
      await bannersPage.textAlignmentRadioGroup('bannerFooter').set(2);
      await bannersPage.textDecorationCheckbox('bannerFooter', 'Bold').set();
      await bannersPage.textDecorationCheckbox('bannerFooter', 'Italic').set();
      await bannersPage.textDecorationCheckbox('bannerFooter', 'Underline').set();
      await bannersPage.selectFontSizeByValue('bannerFooter', settings.fontSize.new);

      const textColor2 = await bannersPage.textColorPicker(2).value();

      expect(textColor2).not.toBe(settings.bannerTextColor.new.toLowerCase());
      await bannersPage.textColorPicker(2).set(settings.bannerTextColor.new);

      const bgColor3 = await bannersPage.textColorPicker(3).value();

      expect(bgColor3).not.toBe(settings.bannerBackgroundColor.new.toLowerCase());
      await bannersPage.textColorPicker(3).set(settings.bannerBackgroundColor.new);

      await bannersPage.applyAndWait('ui-banners', 200);

      // Check banner in session
      const banner = bannersPage.fixedBanner();

      await expect(banner).toBeVisible();
      await expect(banner).toHaveCSS('background-color', settings.bannerBackgroundColor.newRGB);
      await expect(banner).toHaveCSS('text-align', settings.textAlignment.new.toLowerCase());

      const innerDiv = bannersPage.fixedBannerTextDiv();

      await expect(innerDiv).toHaveCSS('color', settings.bannerTextColor.newRGB);
      await expect(innerDiv).toHaveCSS('font-weight', settings.fontWeight);
      await expect(innerDiv).toHaveCSS('font-style', settings.fontStyle);
      await expect(innerDiv).toHaveCSS('font-size', settings.fontSize.new);

      await bannersPage.footerBannerCheckbox().isChecked();
      await bannersPage.textAlignmentRadioGroup('bannerFooter').isChecked(2);
      expect(await bannersPage.textColorPicker(2).previewColor()).toBe(settings.bannerTextColor.newRGB);
      expect(await bannersPage.textColorPicker(3).previewColor()).toBe(settings.bannerBackgroundColor.newRGB);

      // Check over reload
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(banner).toBeVisible();
      await expect(banner).toHaveCSS('background-color', settings.bannerBackgroundColor.newRGB);
      await expect(banner).toHaveCSS('text-align', settings.textAlignment.new.toLowerCase());

      const innerDivReload = bannersPage.fixedBannerTextDiv();

      await expect(innerDivReload).toHaveCSS('color', settings.bannerTextColor.newRGB);
      await expect(innerDivReload).toHaveCSS('font-weight', settings.fontWeight);
      await expect(innerDivReload).toHaveCSS('font-style', settings.fontStyle);
      await expect(innerDivReload).toHaveCSS('font-size', settings.fontSize.new);

      await bannersPage.footerBannerCheckbox().isChecked();
      await bannersPage.textAlignmentRadioGroup('bannerFooter').isChecked(2);
      expect(await bannersPage.textColorPicker(2).previewColor()).toBe(settings.bannerTextColor.newRGB);
      expect(await bannersPage.textColorPicker(3).previewColor()).toBe(settings.bannerBackgroundColor.newRGB);

      // Hide banner
      await bannersPage.footerBannerCheckbox().set();
      await bannersPage.applyAndWait('ui-banners', 200);
      await expect(bannersPage.fixedBanner()).not.toBeAttached();
    });

    test(
      'can show and hide Login Screen Banner',
      { tag: ['@globalSettings', '@adminUser'] },
      async ({ page, login }) => {
        await bannersPage.goTo();
        await bannersPage.waitForPageWithClusterId();

        // Show banner
        await bannersPage.loginScreenBannerCheckbox().checkVisible();
        await bannersPage.loginScreenBannerCheckbox().set();
        await bannersPage.loginScreenTextArea().fill(settings.bannerLabel);
        await bannersPage.textAlignmentRadioGroup('bannerConsent').set(2);
        await bannersPage.textDecorationCheckbox('bannerConsent', 'Bold').set();
        await bannersPage.textDecorationCheckbox('bannerConsent', 'Italic').set();
        await bannersPage.textDecorationCheckbox('bannerConsent', 'Underline').set();
        await bannersPage.selectFontSizeByValue('bannerConsent', settings.fontSize.new);

        const textColor4 = await bannersPage.textColorPicker(4).value();

        expect(textColor4).not.toBe(settings.bannerTextColor.new.toLowerCase());
        await bannersPage.textColorPicker(4).set(settings.bannerTextColor.new);

        const bgColor5 = await bannersPage.textColorPicker(5).value();

        expect(bgColor5).not.toBe(settings.bannerBackgroundColor.new.toLowerCase());
        await bannersPage.textColorPicker(5).set(settings.bannerBackgroundColor.new);

        await bannersPage.applyAndWait('ui-banners', 200);

        // Logout and check login screen
        const userMenu = new UserMenuPo(page);

        await userMenu.clickMenuItem('Log Out');
        const loginPage = new LoginPagePo(page);

        await loginPage.waitForPage();
        await expect(loginPage.loginPageMessage()).toContainText('You have been logged out.');

        const consentBanner = bannersPage.consentBannerContent();

        await expect(consentBanner).toBeVisible();
        await expect(consentBanner).toHaveCSS('background-color', settings.bannerBackgroundColor.newRGB);
        await expect(consentBanner).toHaveCSS('text-align', settings.textAlignment.new.toLowerCase());

        const consentDiv = bannersPage.consentBannerTextDiv();

        await expect(consentDiv).toHaveCSS('color', settings.bannerTextColor.newRGB);
        await expect(consentDiv).toHaveCSS('font-weight', settings.fontWeight);
        await expect(consentDiv).toHaveCSS('font-style', settings.fontStyle);
        await expect(consentDiv).toHaveCSS('font-size', settings.fontSize.new);

        // Login again and verify settings persisted
        await login();
        await bannersPage.goTo();
        await bannersPage.waitForPageWithClusterId();
        await bannersPage.loginScreenBannerCheckbox().isChecked();
        await bannersPage.textAlignmentRadioGroup('bannerConsent').isChecked(2);
        expect(await bannersPage.textColorPicker(4).previewColor()).toBe(settings.bannerTextColor.newRGB);
        expect(await bannersPage.textColorPicker(5).previewColor()).toBe(settings.bannerBackgroundColor.newRGB);

        // Hide banner
        await bannersPage.loginScreenBannerCheckbox().set();
        await bannersPage.applyAndWait('ui-banners', 200);

        // Logout and verify no banner
        await userMenu.clickMenuItem('Log Out');
        await loginPage.waitForPage();
        await expect(loginPage.loginPageMessage()).toContainText('You have been logged out.');
        await expect(bannersPage.consentBanner()).not.toBeAttached();
      },
    );

    test(
      'can show and hide Login Failed Banner',
      { tag: ['@globalSettings', '@adminUser'] },
      async ({ page, login }) => {
        // --- Show ---
        await bannersPage.goTo();
        await bannersPage.waitForPageWithClusterId();

        await bannersPage.loginErrorCheckbox().checkVisible();
        await bannersPage.loginErrorCheckbox().set();
        await bannersPage.loginErrorInput().set(settings.bannerLabel);
        await bannersPage.applyAndWait('ui-banners', 200);

        // Logout and attempt a failed login
        const userMenu = new UserMenuPo(page);

        await userMenu.clickMenuItem('Log Out');
        const loginPage = new LoginPagePo(page);

        await loginPage.waitForPage();
        await expect(loginPage.loginPageMessage()).toContainText('You have been logged out.');
        await loginPage.submitButton().click();
        await expect(bannersPage.bannerByText(settings.bannerLabel)).toBeVisible();

        // --- Hide ---
        await login();
        await bannersPage.goTo();
        await bannersPage.waitForPageWithClusterId();

        await bannersPage.loginErrorCheckbox().checkVisible();
        await bannersPage.loginErrorCheckbox().set();
        await bannersPage.applyAndWait('ui-banners', 200);

        // Logout and verify no custom error
        await userMenu.clickMenuItem('Log Out');
        await loginPage.waitForPage();
        await expect(loginPage.loginPageMessage()).toContainText('You have been logged out.');
        await expect(bannersPage.bannerByText(settings.bannerLabel)).not.toBeAttached();
      },
    );

    test.describe('HTML Banners', { tag: ['@globalSettings', '@adminUser'] }, () => {
      test('can show and hide an HTML Header Banner', async ({ page }) => {
        await bannersPage.goTo();
        await bannersPage.waitForPageWithClusterId();

        // Show banner
        await bannersPage.headerBannerCheckbox().set();
        await bannersPage.headerBannerCheckbox().hasAppropriateWidth();
        await bannersPage.headerBannerCheckbox().hasAppropriateHeight();
        await bannersPage.contentTypeToggle('bannerHeader').set('HTML');
        await bannersPage.htmlTextArea('bannerHeader').fill(bannerHtml);
        await bannersPage.textColorPicker(0).set(settings.bannerTextColor.new);
        await bannersPage.textColorPicker(1).set(settings.bannerBackgroundColor.new);
        await bannersPage.applyAndWait('ui-banners', 200);

        // Check banner colors
        const banner = bannersPage.fixedBanner();

        await expect(banner).toBeVisible();
        await expect(banner).toHaveCSS('background-color', settings.bannerBackgroundColor.newRGB);

        // Verify HTML content is rendered and sanitized (XSS onload stripped)
        await expect(bannersPage.bannerParagraph(banner)).toContainText("SUSE's Terms and Conditions");
        const imgHtml = await bannersPage.bannerImgOuterHtml(banner);

        expect(imgHtml).not.toContain('onload');

        await bannersPage.headerBannerCheckbox().isChecked();
        expect(await bannersPage.textColorPicker(1).previewColor()).toBe(settings.bannerBackgroundColor.newRGB);
        await bannersPage.contentTypeToggle('bannerHeader').shouldContainText('HTML');
        await expect(bannersPage.htmlTextArea('bannerHeader')).toHaveValue(bannerHtml);

        // Check over reload
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(banner).toBeVisible();
        await expect(banner).toHaveCSS('background-color', settings.bannerBackgroundColor.newRGB);

        await bannersPage.headerBannerCheckbox().isChecked();
        expect(await bannersPage.textColorPicker(0).previewColor()).toBe(settings.bannerTextColor.newRGB);
        expect(await bannersPage.textColorPicker(1).previewColor()).toBe(settings.bannerBackgroundColor.newRGB);

        // Hide banner
        await bannersPage.headerBannerCheckbox().set();
        await bannersPage.applyAndWait('ui-banners', 200);
        await expect(bannersPage.fixedBanner()).not.toBeAttached();
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      test('can show HTML banner in the login confirmation dialog', async ({ page, login, envMeta }) => {
        await bannersPage.goTo();
        await bannersPage.waitForPageWithClusterId();

        // Enable consent banner as dialog with HTML content
        await bannersPage.loginScreenBannerCheckbox().checkVisible();
        await bannersPage.loginScreenBannerCheckbox().set();
        await bannersPage.consentBannerShowAsDialogCheckbox().checkVisible();
        await bannersPage.consentBannerShowAsDialogCheckbox().ensureChecked();
        await bannersPage.contentTypeToggle('bannerConsent').set('HTML');
        await bannersPage.htmlTextArea('bannerConsent').fill(bannerHtml);
        await bannersPage.acceptButtonInput('bannerConsent').fill(acceptButtonText);
        await bannersPage.textColorPicker(4).set(settings.bannerTextColor.new);
        await bannersPage.textColorPicker(5).set(settings.bannerBackgroundColor.new);
        await bannersPage.applyAndWait('ui-banners', 200);

        // Logout and check login screen
        const userMenu = new UserMenuPo(page);

        await userMenu.clickMenuItem('Log Out');
        const loginPage = new LoginPagePo(page);

        await loginPage.waitForPage();
        await expect(loginPage.loginPageMessage()).toContainText('You have been logged out.');

        // Verify the dialog appears
        const dialog = bannersPage.loginConfirmationDialog();

        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveCSS('background-color', settings.bannerBackgroundColor.newRGB);

        // Verify sanitized HTML in dialog
        await expect(bannersPage.bannerParagraph(dialog)).toContainText("SUSE's Terms and Conditions");
        const dialogImgHtml = await bannersPage.bannerImgOuterHtml(dialog);

        expect(dialogImgHtml).not.toContain('onload');

        // Login by accepting the consent dialog first, then entering credentials
        await loginPage.confirmationAcceptButton().self().click();
        await loginPage.switchToLocal();
        await loginPage.username().set(envMeta.username);
        await loginPage.password().set(envMeta.password);
        await loginPage.submitButton().click();
        await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 60000 });

        // Verify settings persisted
        await bannersPage.goTo();
        await bannersPage.waitForPageWithClusterId();
        await bannersPage.loginScreenBannerCheckbox().isChecked();
        expect(await bannersPage.textColorPicker(4).previewColor()).toBe(settings.bannerTextColor.newRGB);
        expect(await bannersPage.textColorPicker(5).previewColor()).toBe(settings.bannerBackgroundColor.newRGB);
        await bannersPage.consentBannerShowAsDialogCheckbox().isChecked();
        await bannersPage.contentTypeToggle('bannerConsent').shouldContainText('HTML');
        await expect(bannersPage.htmlTextArea('bannerConsent')).toHaveValue(bannerHtml);
        await expect(bannersPage.acceptButtonInput('bannerConsent')).toHaveValue(acceptButtonText);

        // Hide banner
        await bannersPage.loginScreenBannerCheckbox().set();
        await bannersPage.applyAndWait('ui-banners', 200);

        // Logout and verify no banner
        await userMenu.clickMenuItem('Log Out');
        await loginPage.waitForPage();
        await expect(loginPage.loginPageMessage()).toContainText('You have been logged out.');
        await expect(bannersPage.consentBanner()).not.toBeAttached();
      });
    });
  });

  test.describe('Standard User', () => {
    test(
      'standard user has only read access to Banner page',
      { tag: ['@globalSettings', '@standardUser'] },
      async ({ page, login, envMeta }) => {
        await login({ username: 'standard_user', password: envMeta.password });
        const bannersPage = new BannersPagePo(page);
        const homePage = new HomePagePo(page);

        await homePage.goTo();

        const burgerMenu = new BurgerMenuPo(page);
        const sideNav = new ProductNavPo(page);

        await burgerMenu.toggle();
        await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
        await sideNav.navToSideMenuEntryByLabel('Banners');

        // Standard user reaches the banners page but cannot save changes.
        // The Apply button is hidden (schema has no PUT) and checkboxes are rendered
        // with aria-disabled on the inner .checkbox-custom span (mode=_VIEW).
        await bannersPage.headerBannerCheckbox().isDisabled();
        await expect(bannersPage.saveButton().self()).not.toBeAttached();
      },
    );
  });

  // --- Individual Banner Setting Tests ---
  // Header and Footer share the same test pattern (like upstream bannerTests()).
  // Consent is separate because it requires login page assertions.

  function individualBannerTests(
    bannerName: 'Header' | 'Footer',
    settingKey: 'showHeader' | 'showFooter',
    individualSettingId: 'ui-banner-header' | 'ui-banner-footer',
  ) {
    test.describe(`${bannerName} Banner (Individual Setting)`, () => {
      let bannersPage: BannersPagePo;

      test.beforeEach(async ({ login, page, rancherApi }) => {
        await login();
        bannersPage = new BannersPagePo(page);

        // Ensure banner is off via ui-banners
        const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banners');
        const banners = resp.body;
        const value = JSON.parse(banners.value || '{}');

        value[settingKey] = 'false';
        banners.value = JSON.stringify(value);
        await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banners', banners);

        // Clear the individual setting
        const indResp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', individualSettingId);

        if (indResp.body.value) {
          indResp.body.value = '';
          await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', individualSettingId, indResp.body);
        }
      });

      const getBannerLocator = (bp: BannersPagePo) => (bannerName === 'Header' ? bp.headerBanner() : bp.footerBanner());
      const getBannerContent = (bp: BannersPagePo) =>
        bannerName === 'Header' ? bp.headerBannerContent() : bp.footerBannerContent();

      test('Should not have banner', { tag: ['@globalSettings', '@adminUser'] }, async ({ page }) => {
        const homePage = new HomePagePo(page);

        await homePage.goTo();
        await expect(getBannerLocator(bannersPage)).not.toBeAttached();
      });

      test(
        'Should use banner from ui-banners setting',
        { tag: ['@globalSettings', '@adminUser'] },
        async ({ page, rancherApi }) => {
          const homePage = new HomePagePo(page);

          await homePage.goTo();
          await expect(getBannerLocator(bannersPage)).not.toBeAttached();

          // Enable the banner via ui-banners
          let resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banners');
          let banners = resp.body;
          let value = JSON.parse(banners.value || '{}');

          value[settingKey] = 'true';
          const bannerKey = `banner${bannerName}`;

          value[bannerKey] = value[bannerKey] || {};
          value[bannerKey].text = 'TEST Banner (ui-banners)';
          value[bannerKey].background = '#00ff00';
          banners.value = JSON.stringify(value);
          await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banners', banners);

          await homePage.goTo();
          const banner = getBannerLocator(bannersPage);

          await expect(banner).toBeAttached();
          await expect(banner).toContainText('TEST Banner (ui-banners)');
          await expect(getBannerContent(bannersPage)).toHaveCSS('background-color', 'rgb(0, 255, 0)');

          // Turn off the banner
          resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banners');
          banners = resp.body;
          value = JSON.parse(banners.value || '{}');
          value[settingKey] = 'false';
          banners.value = JSON.stringify(value);
          await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banners', banners);

          await homePage.goTo();
          await expect(getBannerLocator(bannersPage)).not.toBeAttached();
        },
      );

      test(
        'Should use banner from individual setting',
        { tag: ['@globalSettings', '@adminUser'] },
        async ({ page, rancherApi }) => {
          const homePage = new HomePagePo(page);

          await homePage.goTo();
          await expect(getBannerLocator(bannersPage)).not.toBeAttached();

          // Set the banner via the individual setting
          const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', individualSettingId);

          resp.body.value = JSON.stringify({ text: 'Test Banner (individual setting)', background: '#ff0000' });
          await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', individualSettingId, resp.body);

          await homePage.goTo();
          const banner = getBannerLocator(bannersPage);

          await expect(banner).toBeAttached();
          await expect(banner).toContainText('Test Banner (individual setting)');
          await expect(getBannerContent(bannersPage)).toHaveCSS('background-color', 'rgb(255, 0, 0)');

          // Unset the individual banner
          const resp2 = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', individualSettingId);

          resp2.body.value = '';
          await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', individualSettingId, resp2.body);

          await homePage.goTo();
          await expect(getBannerLocator(bannersPage)).not.toBeAttached();
        },
      );

      test(
        'Should prefer setting from individual setting',
        { tag: ['@globalSettings', '@adminUser'] },
        async ({ page, rancherApi }) => {
          const homePage = new HomePagePo(page);

          await homePage.goTo();
          await expect(getBannerLocator(bannersPage)).not.toBeAttached();

          // Enable via ui-banners
          let resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banners');
          let banners = resp.body;
          let value = JSON.parse(banners.value || '{}');
          const bannerKey = `banner${bannerName}`;

          value[settingKey] = 'true';
          value[bannerKey] = value[bannerKey] || {};
          value[bannerKey].text = 'TEST Banner (ui-banners)';
          value[bannerKey].background = '#00ff00';
          banners.value = JSON.stringify(value);
          await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banners', banners);

          await homePage.goTo();
          await expect(getBannerLocator(bannersPage)).toContainText('TEST Banner (ui-banners)');

          // Set individual setting — should override
          const indResp = await rancherApi.getRancherResource(
            'v1',
            'management.cattle.io.settings',
            individualSettingId,
          );

          indResp.body.value = JSON.stringify({ text: 'Test Banner (individual setting)', background: '#ff0000' });
          await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', individualSettingId, indResp.body);

          await homePage.goTo();
          await expect(getBannerLocator(bannersPage)).toContainText('Test Banner (individual setting)');
          await expect(getBannerContent(bannersPage)).toHaveCSS('background-color', 'rgb(255, 0, 0)');

          // Turn off via banners setting — individual should still apply
          resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banners');
          banners = resp.body;
          value = JSON.parse(banners.value || '{}');
          value[settingKey] = 'false';
          banners.value = JSON.stringify(value);
          await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banners', banners);

          await homePage.goTo();
          await expect(getBannerLocator(bannersPage)).toContainText('Test Banner (individual setting)');

          // Unset the individual banner
          const indResp2 = await rancherApi.getRancherResource(
            'v1',
            'management.cattle.io.settings',
            individualSettingId,
          );

          indResp2.body.value = '';
          await rancherApi.setRancherResource(
            'v1',
            'management.cattle.io.settings',
            individualSettingId,
            indResp2.body,
          );

          await homePage.goTo();
          await expect(getBannerLocator(bannersPage)).not.toBeAttached();
        },
      );
    });
  }

  individualBannerTests('Header', 'showHeader', 'ui-banner-header');
  individualBannerTests('Footer', 'showFooter', 'ui-banner-footer');

  test.describe('Login Consent Banner (Individual Setting)', () => {
    let bannersPage: BannersPagePo;

    test.beforeEach(async ({ login, page, rancherApi }) => {
      await login();
      bannersPage = new BannersPagePo(page);

      const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banners');
      const banners = resp.body;
      const value = JSON.parse(banners.value || '{}');

      value.showConsent = 'false';
      banners.value = JSON.stringify(value);
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banners', banners);

      const indResp = await rancherApi.getRancherResource(
        'v1',
        'management.cattle.io.settings',
        'ui-banner-login-consent',
      );

      if (indResp.body.value) {
        indResp.body.value = '';
        await rancherApi.setRancherResource(
          'v1',
          'management.cattle.io.settings',
          'ui-banner-login-consent',
          indResp.body,
        );
      }
    });

    test('Should not have banner', { tag: ['@globalSettings', '@adminUser'] }, async ({ page }) => {
      await page.goto('./auth/login', { waitUntil: 'domcontentloaded' });
      await expect(bannersPage.loginSubmitButton()).toBeVisible();
      await expect(bannersPage.consentBanner()).not.toBeAttached();
    });

    test(
      'Should use banner from individual setting',
      { tag: ['@globalSettings', '@adminUser'] },
      async ({ page, rancherApi, login }) => {
        const resp = await rancherApi.getRancherResource(
          'v1',
          'management.cattle.io.settings',
          'ui-banner-login-consent',
        );

        resp.body.value = JSON.stringify({ text: 'Test Banner (individual setting)', background: '#ff0000' });
        await rancherApi.setRancherResource(
          'v1',
          'management.cattle.io.settings',
          'ui-banner-login-consent',
          resp.body,
        );

        await page.goto('./auth/login', { waitUntil: 'domcontentloaded' });

        const banner = bannersPage.consentBanner();

        await expect(banner).toBeAttached();
        await expect(banner).toContainText('Test Banner (individual setting)');
        await expect(bannersPage.consentBannerContent()).toHaveCSS('background-color', 'rgb(255, 0, 0)');

        // Login again to clean up via API
        await login();
        const resp2 = await rancherApi.getRancherResource(
          'v1',
          'management.cattle.io.settings',
          'ui-banner-login-consent',
        );

        resp2.body.value = '';
        await rancherApi.setRancherResource(
          'v1',
          'management.cattle.io.settings',
          'ui-banner-login-consent',
          resp2.body,
        );
      },
    );

    test(
      'Should prefer banner from individual setting',
      { tag: ['@globalSettings', '@adminUser'] },
      async ({ page, rancherApi, login }) => {
        const indResp = await rancherApi.getRancherResource(
          'v1',
          'management.cattle.io.settings',
          'ui-banner-login-consent',
        );

        indResp.body.value = JSON.stringify({ text: 'Test Banner (individual setting)', background: '#ff0000' });
        await rancherApi.setRancherResource(
          'v1',
          'management.cattle.io.settings',
          'ui-banner-login-consent',
          indResp.body,
        );

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

        // Go to login screen — individual should override ui-banners
        await page.goto('./auth/login', { waitUntil: 'domcontentloaded' });
        await expect(bannersPage.loginSubmitButton()).toBeVisible();

        const banner = bannersPage.consentBanner();

        await expect(banner).toBeAttached();
        await expect(banner).toContainText('Test Banner (individual setting)');
        await expect(bannersPage.consentBannerContent()).toHaveCSS('background-color', 'rgb(255, 0, 0)');

        // Login again to clean up
        await login();

        // Unset individual setting
        const indResp2 = await rancherApi.getRancherResource(
          'v1',
          'management.cattle.io.settings',
          'ui-banner-login-consent',
        );

        indResp2.body.value = '';
        await rancherApi.setRancherResource(
          'v1',
          'management.cattle.io.settings',
          'ui-banner-login-consent',
          indResp2.body,
        );

        // Turn off via banners setting
        resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-banners');
        banners = resp.body;
        value = JSON.parse(banners.value || '{}');
        value.showConsent = 'false';
        banners.value = JSON.stringify(value);
        await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-banners', banners);

        // Verify no banners on login screen
        await page.goto('./auth/login', { waitUntil: 'domcontentloaded' });
        await expect(bannersPage.loginSubmitButton()).toBeVisible();
        await expect(banner).not.toBeAttached();
      },
    );
  });
});
