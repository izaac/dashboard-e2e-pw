import { test, expect } from '@/support/fixtures';
import { BrandingPagePo } from '@/e2e/po/pages/global-settings/branding.po';
import { SettingsPagePo } from '@/e2e/po/pages/global-settings/settings.po';
import HomePagePo from '@/e2e/po/pages/home.po';
import { LoginPagePo } from '@/e2e/po/pages/login-page.po';
import PreferencesPagePo from '@/e2e/po/pages/preferences.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';
import * as fs from 'fs';
import * as path from 'path';
import { BRIEF } from '@/support/timeouts';

const settings = {
  privateLabel: {
    original: 'Rancher',
    new: 'Rancher e2e',
  },
  primaryColor: {
    original: '#3d98d3',
    new: '#f80dd8',
    newRGB: 'rgb(248, 13, 216)',
  },
  linkColor: {
    original: '#3d98d3',
    new: '#ddd603',
    newRGB: 'rgb(221, 214, 3)',
  },
};

/** Read an SVG fixture and return its base64 encoding */
function fixtureBase64(relativePath: string): string {
  const fullPath = path.resolve(__dirname, '../../../blueprints', relativePath);

  return fs.readFileSync(fullPath).toString('base64');
}

/** Navigate to branding page via burger menu */
async function navToBranding(page: any) {
  const burgerMenu = new BurgerMenuPo(page);
  const sideNav = new ProductNavPo(page);

  await burgerMenu.toggle();
  await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
  await sideNav.navToSideMenuEntryByLabel('Branding');
}

/** Navigate to preferences page */
async function navToPreferences(page: any) {
  await page.goto('./prefs', { waitUntil: 'domcontentloaded' });
}

/** Set theme via preferences page and wait for API confirmation */
async function setTheme(page: any, theme: 'Dark' | 'Light') {
  const prefPage = new PreferencesPagePo(page);

  await navToPreferences(page);
  await expect(prefPage.themeButtons().self()).toBeVisible();

  const prefResponsePromise = page.waitForResponse(
    (resp: any) => resp.url().includes('v1/userpreferences') && resp.request().method() === 'PUT',
  );

  await prefPage.themeButtons().set(theme);
  const resp = await prefResponsePromise;

  expect(resp.status()).toBe(200);
}

const BRANDING_SETTINGS = [
  'ui-logo-light',
  'ui-logo-dark',
  'ui-banner-light',
  'ui-banner-dark',
  'ui-login-background-light',
  'ui-login-background-dark',
  'ui-primary-color',
  'ui-link-color',
  'ui-favicon',
];

test.describe('Branding', () => {
  // Serial: tests mutate the BRANDING_SETTINGS singletons and rely on per-test snapshot/restore; parallel runs would race the resourceVersion handshake.
  test.describe.configure({ mode: 'serial' });
  let savedBrandingValues: Record<string, { value: string; resourceVersion: string }> = {};

  test.beforeEach(async ({ login, rancherApi }) => {
    savedBrandingValues = {};

    for (const setting of BRANDING_SETTINGS) {
      try {
        const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', setting, 0);

        if (resp.status === 200) {
          savedBrandingValues[setting] = {
            value: resp.body.value || '',
            resourceVersion: resp.body.metadata.resourceVersion,
          };
        }
      } catch (err) {
        // Setting may not exist yet — will be created by the test. Log so genuine API/auth
        // failures still surface in CI rather than being silently treated as "not yet created".
        console.warn(`[branding beforeEach] saving ${setting} failed: ${(err as Error)?.message ?? err}`);
      }
    }

    await login();
  });

  test.afterEach(async ({ rancherApi }) => {
    for (const setting of BRANDING_SETTINGS) {
      try {
        const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', setting, 0);

        if (resp.status !== 200) {
          continue;
        }

        const original = savedBrandingValues[setting];
        const currentValue = resp.body.value || '';
        const restoreValue = original?.value || '';

        if (currentValue !== restoreValue) {
          resp.body.value = restoreValue;
          await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', setting, resp.body);
        }
      } catch (err) {
        // Best-effort restore: setting may have been deleted or not exist. Log so genuine
        // API/auth failures aren't silently swallowed and leak state into the next test.
        console.warn(`[branding afterEach] restoring ${setting} failed: ${(err as Error)?.message ?? err}`);
      }
    }
  });

  test(
    'Can navigate to Branding Page',
    { tag: ['@globalSettings', '@adminUser', '@standardUser'] },
    async ({ page }) => {
      const burgerMenu = new BurgerMenuPo(page);
      const sideNav = new ProductNavPo(page);

      await burgerMenu.toggle();

      const globalSettingsNavItem = burgerMenu.links().filter({ hasText: 'Global Settings' });

      await expect(globalSettingsNavItem).toBeAttached();
      await globalSettingsNavItem.click();

      const settingsPage = new SettingsPagePo(page, '_');

      await settingsPage.waitForPageWithClusterId();

      // check if burger menu nav is highlighted correctly for Global Settings
      await expect(burgerMenu.menuItemWrapper('Global Settings')).toHaveClass(/active-menu-link/);

      // catching regression https://github.com/rancher/dashboard/issues/10576
      await expect(burgerMenu.clusterOptionWrapper('local')).not.toHaveClass(/active/);

      const brandingNavItem = sideNav.sideMenuEntryByLabel('Branding');

      await expect(brandingNavItem).toBeAttached();
      await brandingNavItem.click();

      const brandingPage = new BrandingPagePo(page);

      await brandingPage.waitForPageWithClusterId();
    },
  );

  test('Private Label', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, rancherApi }) => {
    const brandingPage = new BrandingPagePo(page);
    const homePage = new HomePagePo(page);
    const burgerMenu = new BurgerMenuPo(page);

    await navToBranding(page);

    // Set
    await expect(page).not.toHaveTitle(settings.privateLabel.new);
    await brandingPage.privateLabel().set(settings.privateLabel.new);

    // Apply
    await brandingPage.applyAndWait('ui-pl', 200);

    // Visit the Home Page
    await burgerMenu.toggle();
    await burgerMenu.home().click();

    await expect(homePage.title()).toHaveText(`Welcome to ${settings.privateLabel.new}`);

    // Check in session
    await expect(page).toHaveTitle(`${settings.privateLabel.new} - Homepage`);

    // Check over reload
    await page.reload();
    await expect(page).toHaveTitle(new RegExp(settings.privateLabel.new));

    await navToBranding(page);

    // Reset
    await brandingPage.privateLabel().set(settings.privateLabel.original);
    await brandingPage.applyAndWait('ui-pl', 200);

    await burgerMenu.toggle();
    await burgerMenu.home().click();
    await expect(page).toHaveTitle(new RegExp(`${settings.privateLabel.original} - Homepage`), { timeout: BRIEF });

    // Also reset via API in case UI test failed partway. Re-fetch to get a fresh
    // resourceVersion so the PUT does not 409 against a racing controller mutation.
    try {
      const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-pl');
      const resourceVersion = resp.body.metadata.resourceVersion;

      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-pl', {
        value: settings.privateLabel.original.toLowerCase(),
        metadata: { name: 'ui-pl', resourceVersion },
      });
    } catch (err) {
      // Best-effort defensive reset — log so a genuine API failure surfaces in CI rather
      // than silently leaking ui-pl state into the next test.
      console.warn(`[branding] defensive ui-pl reset failed: ${(err as Error)?.message ?? err}`);
    }
  });

  test('Logo', { tag: ['@globalSettings', '@adminUser'] }, async ({ page }) => {
    const brandingPage = new BrandingPagePo(page);
    const burgerMenu = new BurgerMenuPo(page);

    await navToBranding(page);
    await brandingPage.customLogoCheckbox().set();

    // Regression check: checkbox dimensions — https://github.com/rancher/dashboard/issues/10000
    await expect(brandingPage.customLogoCheckbox().checkboxCustom()).toHaveCSS('width', '14px');
    await expect(brandingPage.customLogoCheckbox().checkboxCustom()).toHaveCSS('height', '14px');

    // Upload Light Logo
    await brandingPage
      .uploadButton('Upload Light Logo')
      .setInputFiles(path.resolve(__dirname, '../../../blueprints/branding/logos/rancher-color.svg'));

    // Upload Dark Logo
    await brandingPage
      .uploadButton('Upload Dark Logo')
      .setInputFiles(path.resolve(__dirname, '../../../blueprints/branding/logos/rancher-white.svg'));

    // Apply
    await brandingPage.applyAndWait('ui-logo-light', 200);

    // Logo Preview
    await brandingPage.logoPreview('dark').scrollIntoViewIfNeeded();
    await expect(brandingPage.logoPreview('dark')).toBeVisible();
    await brandingPage.logoPreview('light').scrollIntoViewIfNeeded();
    await expect(brandingPage.logoPreview('light')).toBeVisible();

    // Set Dark theme and check header logo
    await setTheme(page, 'Dark');

    const darkLogoBase64 = fixtureBase64('branding/logos/rancher-white.svg');

    await expect(burgerMenu.headerBrandLogoImage()).toBeVisible();
    await expect(burgerMenu.headerBrandLogoImage()).toHaveAttribute(
      'src',
      `data:image/svg+xml;base64,${darkLogoBase64}`,
    );

    await burgerMenu.toggle();
    await expect(burgerMenu.brandLogoImage()).toBeVisible();
    await expect(burgerMenu.brandLogoImage()).toHaveAttribute('src', `data:image/svg+xml;base64,${darkLogoBase64}`);
    await burgerMenu.toggle();

    // Set Light theme and check header logo
    await setTheme(page, 'Light');

    const lightLogoBase64 = fixtureBase64('branding/logos/rancher-color.svg');

    await expect(burgerMenu.headerBrandLogoImage()).toBeVisible();
    await expect(burgerMenu.headerBrandLogoImage()).toHaveAttribute(
      'src',
      `data:image/svg+xml;base64,${lightLogoBase64}`,
    );

    await burgerMenu.toggle();
    await expect(burgerMenu.brandLogoImage()).toBeVisible();
    await expect(burgerMenu.brandLogoImage()).toHaveAttribute('src', `data:image/svg+xml;base64,${lightLogoBase64}`);

    // Reset
    await navToBranding(page);
    await brandingPage.customLogoCheckbox().set();
    await brandingPage.applyAndWait('ui-logo-light', 200);

    const homePage = new HomePagePo(page);

    await homePage.goTo();
    await expect(burgerMenu.headerBrandLogoImage()).toBeVisible();
    await expect(burgerMenu.headerBrandLogoImage()).toHaveAttribute('src', /\/img\/rancher-logo/);

    await burgerMenu.toggle();
    await expect(burgerMenu.brandLogoImage()).toBeVisible();
    await expect(burgerMenu.brandLogoImage()).toHaveAttribute('src', /\/img\/rancher-logo/);
  });

  test('Banner', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, rancherApi }) => {
    const brandingPage = new BrandingPagePo(page);
    const homePage = new HomePagePo(page);

    // Reset banner visibility preferences
    await rancherApi.setUserPreference({ 'home-page-cards': '{}' });

    await navToBranding(page);
    await brandingPage.customBannerCheckbox().set();
    await expect(brandingPage.customBannerCheckbox().checkboxCustom()).toHaveCSS('width', '14px');
    await expect(brandingPage.customBannerCheckbox().checkboxCustom()).toHaveCSS('height', '14px');

    // Upload Light Banner
    await brandingPage
      .uploadButton('Upload Light Banner')
      .setInputFiles(path.resolve(__dirname, '../../../blueprints/branding/banners/banner-light.svg'));

    // Upload Dark Banner
    await brandingPage
      .uploadButton('Upload Dark Banner')
      .setInputFiles(path.resolve(__dirname, '../../../blueprints/branding/banners/banner-dark.svg'));

    // Apply
    await brandingPage.applyAndWait('ui-banner-light', 200);

    // Banner Preview
    await brandingPage.bannerPreview('dark').scrollIntoViewIfNeeded();
    await expect(brandingPage.bannerPreview('dark')).toBeVisible();
    await brandingPage.bannerPreview('light').scrollIntoViewIfNeeded();
    await expect(brandingPage.bannerPreview('light')).toBeVisible();

    // Set Dark theme and check home banner
    await setTheme(page, 'Dark');

    const darkBannerBase64 = fixtureBase64('branding/banners/banner-dark.svg');

    await homePage.goTo();
    await expect(homePage.getBrandBannerImage()).toBeVisible();
    await expect(homePage.getBrandBannerImage()).toHaveAttribute(
      'src',
      `data:image/svg+xml;base64,${darkBannerBase64}`,
    );

    // Set Light theme and check home banner
    await setTheme(page, 'Light');

    const lightBannerBase64 = fixtureBase64('branding/banners/banner-light.svg');

    await homePage.goTo();
    await expect(homePage.getBrandBannerImage()).toBeVisible();
    await expect(homePage.getBrandBannerImage()).toHaveAttribute(
      'src',
      `data:image/svg+xml;base64,${lightBannerBase64}`,
    );

    // Reset
    await navToBranding(page);
    await brandingPage.customBannerCheckbox().set();
    await brandingPage.applyAndWait('ui-banner-light', 200);

    await homePage.goTo();
    await expect(homePage.getBrandBannerImage()).toBeVisible();
    await expect(homePage.getBrandBannerImage()).toHaveAttribute('src', /\/img\/banner/);
  });

  test('Login Background', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, login }) => {
    const brandingPage = new BrandingPagePo(page);
    const loginPage = new LoginPagePo(page);

    await navToBranding(page);

    await brandingPage.customLoginBackgroundCheckbox().set();
    await expect(brandingPage.customLoginBackgroundCheckbox().checkboxCustom()).toHaveCSS('width', '14px');
    await expect(brandingPage.customLoginBackgroundCheckbox().checkboxCustom()).toHaveCSS('height', '14px');

    await brandingPage
      .uploadButton('Upload Light Background')
      .setInputFiles(path.resolve(__dirname, '../../../blueprints/branding/backgrounds/login-landscape-light.svg'));

    await brandingPage
      .uploadButton('Upload Dark Background')
      .setInputFiles(path.resolve(__dirname, '../../../blueprints/branding/backgrounds/login-landscape-dark.svg'));

    await brandingPage.applyAndWait('ui-login-background-light', 200);

    await brandingPage.loginBackgroundPreview('dark').scrollIntoViewIfNeeded();
    await expect(brandingPage.loginBackgroundPreview('dark')).toBeVisible();
    await brandingPage.loginBackgroundPreview('light').scrollIntoViewIfNeeded();
    await expect(brandingPage.loginBackgroundPreview('light')).toBeVisible();

    // Dark theme — verify dark background on login page
    await setTheme(page, 'Dark');

    const darkBgBase64 = fixtureBase64('branding/backgrounds/login-landscape-dark.svg');

    await loginPage.goTo();
    await expect(loginPage.loginBackgroundImage()).toBeVisible();
    await expect(loginPage.loginBackgroundImage()).toHaveAttribute('src', `data:image/svg+xml;base64,${darkBgBase64}`);

    await login();
    const homePage = new HomePagePo(page);

    await homePage.goTo();

    // Light theme — verify light background on login page
    await setTheme(page, 'Light');

    const lightBgBase64 = fixtureBase64('branding/backgrounds/login-landscape-light.svg');

    await loginPage.goTo();
    await expect(loginPage.loginBackgroundImage()).toBeVisible();
    await expect(loginPage.loginBackgroundImage()).toHaveAttribute('src', `data:image/svg+xml;base64,${lightBgBase64}`);

    await login();
    const homeFinal = new HomePagePo(page);

    await homeFinal.goTo();

    // Reset
    await navToBranding(page);
    await brandingPage.customLoginBackgroundCheckbox().set();
    await brandingPage.applyAndWait('ui-login-background-light', 200);
  });

  test('Favicon', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, isPrime }) => {
    const brandingPage = new BrandingPagePo(page);

    await navToBranding(page);
    await brandingPage.customFaviconCheckbox().set();

    // Upload Favicon
    await brandingPage
      .uploadButton('Upload Favicon')
      .setInputFiles(path.resolve(__dirname, '../../../blueprints/global/favicons/custom-favicon.svg'));

    const expectedBase64 = fixtureBase64('global/favicons/custom-favicon.svg');

    // Apply and verify response
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('ui-favicon') && resp.request().method() === 'PUT',
    );

    await brandingPage.applyButton().click();
    const response = await responsePromise;

    expect(response.status()).toBe(200);

    const requestBody = response.request().postDataJSON();

    expect(requestBody.value).toBe(`data:image/svg+xml;base64,${expectedBase64}`);

    const responseBody = await response.json();

    expect(responseBody.value).toBe(`data:image/svg+xml;base64,${expectedBase64}`);

    // Favicon Preview
    await expect(brandingPage.faviconPreview()).toBeVisible();
    await expect(brandingPage.faviconPreview()).toHaveAttribute('src', `data:image/svg+xml;base64,${expectedBase64}`);

    // Favicon in header
    await expect(brandingPage.faviconLink()).toHaveAttribute('href', `data:image/svg+xml;base64,${expectedBase64}`);

    // Reset — prime builds restore to SUSE brand favicon (base64), community to /favicon.png
    await brandingPage.customFaviconCheckbox().set();
    await brandingPage.applyAndWait('ui-favicon', 200);

    const expectedFaviconHref: string | RegExp = isPrime
      ? `data:image/png;base64,${fixtureBase64('global/favicons/prime-favicon.png')}`
      : /\/favicon\.png/;

    await expect(brandingPage.faviconLink()).toHaveAttribute('href', expectedFaviconHref);
  });

  test('Primary Color', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, login }) => {
    const brandingPage = new BrandingPagePo(page);
    const loginPage = new LoginPagePo(page);

    await navToBranding(page);

    await brandingPage.primaryColorCheckbox().set();
    const currentValue = await brandingPage.primaryColorPicker().value();

    expect(currentValue).not.toBe(settings.primaryColor.new);

    await brandingPage.primaryColorPicker().set(settings.primaryColor.new);
    await brandingPage.applyAndWait('ui-primary-color', 200);
    await expect(brandingPage.applyButton().self()).toBeEnabled();

    // Check in session
    const setValue = await brandingPage.primaryColorPicker().value();

    expect(setValue).toBe(settings.primaryColor.new);
    const previewColor = await brandingPage.primaryColorPicker().previewColor();

    expect(previewColor).toBe(settings.primaryColor.newRGB);

    // v2.15: CSS variable propagation is async after save — use auto-retry assertion
    await expect(brandingPage.applyButton().self()).toHaveCSS('background-color', /rgb\(24[89],/);

    // Check over reload
    await page.reload();
    const reloadValue = await brandingPage.primaryColorPicker().value();

    expect(reloadValue).toBe(settings.primaryColor.new);
    const reloadPreview = await brandingPage.primaryColorPicker().previewColor();

    expect(reloadPreview).toBe(settings.primaryColor.newRGB);

    // Check login page has new styles — https://github.com/rancher/dashboard/issues/10788
    await loginPage.goTo();
    await expect(loginPage.submitButton().self()).toHaveCSS('background-color', /rgb\(24[89],/);

    await page.reload();
    await expect(loginPage.submitButton().self()).toHaveCSS('background-color', /rgb\(24[89],/);

    // Re-login and reset
    await login();
    const homePage = new HomePagePo(page);

    await homePage.goTo();
    await navToBranding(page);

    await brandingPage.primaryColorPicker().set(settings.primaryColor.original);
    await brandingPage.primaryColorCheckbox().set();
    await brandingPage.applyAndWait('ui-primary-color', 200);
  });

  test('Link Color', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, login }) => {
    const brandingPage = new BrandingPagePo(page);
    const loginPage = new LoginPagePo(page);

    await navToBranding(page);

    // Set
    await brandingPage.linkColorCheckbox().set();
    const currentValue = await brandingPage.linkColorPicker().value();

    expect(currentValue).not.toBe(settings.linkColor.new);

    await brandingPage.linkColorPicker().set(settings.linkColor.new);
    await brandingPage.applyAndWait('ui-link-color', 200);

    // Check in session
    const setValue = await brandingPage.linkColorPicker().value();

    expect(setValue).toBe(settings.linkColor.new);
    const previewColor = await brandingPage.linkColorPicker().previewColor();

    expect(previewColor).toBe(settings.linkColor.newRGB);

    // Check over reload
    await page.reload();
    const reloadValue = await brandingPage.linkColorPicker().value();

    expect(reloadValue).toBe(settings.linkColor.new);
    const reloadPreview = await brandingPage.linkColorPicker().previewColor();

    expect(reloadPreview).toBe(settings.linkColor.newRGB);

    // Check login page has new link color — https://github.com/rancher/dashboard/issues/10788
    await loginPage.goTo();
    const showBtnColor = await loginPage.password().showBtnComputedColor();

    expect(showBtnColor).toBe(settings.linkColor.newRGB);

    await page.reload();
    const showBtnColorReload = await loginPage.password().showBtnComputedColor();

    expect(showBtnColorReload).toBe(settings.linkColor.newRGB);

    // Re-login and reset
    await login();
    const homePage = new HomePagePo(page);

    await homePage.goTo();
    await navToBranding(page);

    await brandingPage.linkColorPicker().set(settings.linkColor.original);
    await brandingPage.linkColorCheckbox().set();
    await brandingPage.applyAndWait('ui-link-color', 200);
  });
});

test.describe('Branding - Standard User', { tag: ['@globalSettings', '@standardUser'] }, () => {
  test('standard user has only read access to Branding page', async ({ page, login, envMeta }) => {
    await login({ username: 'standard_user', password: envMeta.password });

    const brandingPage = new BrandingPagePo(page);
    const burgerMenu = new BurgerMenuPo(page);
    const sideNav = new ProductNavPo(page);

    await burgerMenu.toggle();
    await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
    await sideNav.navToSideMenuEntryByLabel('Branding');

    await expect(brandingPage.privateLabel().self()).toBeDisabled();
    await expect(brandingPage.customLogoCheckbox().checkboxCustom()).toBeDisabled();
    await expect(brandingPage.customFaviconCheckbox().checkboxCustom()).toBeDisabled();
    await expect(brandingPage.primaryColorCheckbox().checkboxCustom()).toBeDisabled();
    await expect(brandingPage.linkColorCheckbox().checkboxCustom()).toBeDisabled();
    await expect(brandingPage.applyButton().self()).not.toBeAttached();
  });
});
