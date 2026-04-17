import { test, expect } from '@/support/fixtures';
import PreferencesPagePo from '@/e2e/po/pages/preferences.po';
import UserMenuPo from '@/e2e/po/side-bars/user-menu.po';

test.describe('User can update their preferences', () => {
  test('Can navigate to Preferences Page', { tag: ['@userMenu', '@adminUser', '@standardUser', '@flaky'] }, async ({ page, login }) => {
    await login();

    const userMenu = new UserMenuPo(page);
    const prefPage = new PreferencesPagePo(page);

    // Navigate to a known page first (preferences page itself works)
    await prefPage.goTo();
    await prefPage.waitForPage();

    // Now test nav via user menu — go to home-ish page first
    await page.goto('./home', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 15000 });

    await userMenu.clickMenuItem('Preferences');
    await userMenu.isClosed();

    await prefPage.waitForPage();
    await prefPage.checkIsCurrentPage();
    await expect(prefPage.title()).toHaveText('Preferences');
  });

  test('Can select a theme', { tag: ['@userMenu', '@adminUser', '@standardUser'] }, async ({ page, login }) => {
    await login();

    const prefPage = new PreferencesPagePo(page);

    await prefPage.goTo();
    await prefPage.waitForPage();

    const themeOptions: Record<string, string> = {
      Light: '"ui-light"',
      Dark:  '"ui-dark"',
      Auto:  '"ui-auto"',
    };

    const themeContainer = prefPage.themeOptions();

    await expect(themeContainer).toBeVisible();

    for (const [key, value] of Object.entries(themeOptions)) {
      const prefUpdatePromise = page.waitForResponse(
        (resp) => resp.url().includes('v1/userpreferences/') && resp.request().method() === 'PUT'
      );

      await themeContainer.getByRole('button', { name: key }).click();

      const resp = await prefUpdatePromise;

      expect(resp.status()).toBe(200);

      const reqBody = resp.request().postDataJSON();
      const respBody = await resp.json();

      expect(reqBody.data).toHaveProperty('theme', value);
      expect(respBody.data).toHaveProperty('theme', value);
    }
  });

  test('Can select date format', { tag: ['@userMenu', '@adminUser', '@standardUser'] }, async ({ page, login }) => {
    await login();

    const prefPage = new PreferencesPagePo(page);

    await prefPage.goTo();
    await prefPage.waitForPage();

    const dateFormatSelect = prefPage.dateFormatSelect();

    await expect(dateFormatSelect).toBeVisible();

    const dateOptions: Record<string, number> = {
      'YYYY-MM-DD':      5,
      'M/D/YYYY':        4,
      'D/M/YYYY':        3,
      'ddd, D MMM YYYY': 2,
      'ddd, MMM D YYYY': 1,
    };

    for (const [key, value] of Object.entries(dateOptions)) {
      // Open dropdown
      await dateFormatSelect.click();
      await expect(prefPage.dropdownOptions()).toHaveCount(5);

      const prefUpdatePromise = page.waitForResponse(
        (resp) => resp.url().includes('v1/userpreferences/') && resp.request().method() === 'PUT'
      );

      // Click option by index
      await prefPage.dropdownOptionByIndex(value).click();

      const resp = await prefUpdatePromise;

      expect(resp.status()).toBe(200);

      const reqBody = resp.request().postDataJSON();
      const respBody = await resp.json();

      expect(reqBody.data).toHaveProperty('date-format', key);
      expect(respBody.data).toHaveProperty('date-format', key);
    }
  });

  test('Can select time format', { tag: ['@userMenu', '@adminUser', '@standardUser'] }, async ({ page, login }) => {
    await login();

    const prefPage = new PreferencesPagePo(page);

    await prefPage.goTo();
    await prefPage.waitForPage();

    const timeFormatSelect = prefPage.timeFormatSelect();

    await expect(timeFormatSelect).toBeVisible();

    const formatOptions: Record<string, number> = {
      'HH:mm:ss':  2,
      'h:mm:ss a': 1,
    };

    for (const [key, value] of Object.entries(formatOptions)) {
      await timeFormatSelect.click();
      await expect(prefPage.dropdownOptions()).toHaveCount(2);

      const prefUpdatePromise = page.waitForResponse(
        (resp) => resp.url().includes('v1/userpreferences/') && resp.request().method() === 'PUT'
      );

      await prefPage.dropdownOptionByIndex(value).click();

      const resp = await prefUpdatePromise;

      expect(resp.status()).toBe(200);

      const reqBody = resp.request().postDataJSON();
      const respBody = await resp.json();

      expect(reqBody.data).toHaveProperty('time-format', key);
      expect(respBody.data).toHaveProperty('time-format', key);
    }
  });

  test('Can select Table Rows per Page', { tag: ['@userMenu', '@adminUser', '@standardUser'] }, async ({ page, login }) => {
    await login();

    const prefPage = new PreferencesPagePo(page);

    await prefPage.goTo();
    await prefPage.waitForPage();

    const perPageSelect = prefPage.perPageSelect();

    await expect(perPageSelect).toBeVisible();

    const perPageOptions: Record<string, number> = {
      10:  1,
      25:  2,
      50:  3,
      100: 4,
    };

    for (const [key, value] of Object.entries(perPageOptions)) {
      await perPageSelect.click();
      await expect(prefPage.dropdownOptions()).toHaveCount(4);

      const prefUpdatePromise = page.waitForResponse(
        (resp) => resp.url().includes('v1/userpreferences/') && resp.request().method() === 'PUT'
      );

      await prefPage.dropdownOptionByIndex(value).click();

      const resp = await prefUpdatePromise;

      expect(resp.status()).toBe(200);

      const reqBody = resp.request().postDataJSON();
      const respBody = await resp.json();

      expect(reqBody.data).toHaveProperty('per-page', key);
      expect(respBody.data).toHaveProperty('per-page', key);
    }
  });

  test('Can select Confirmation Setting', { tag: ['@userMenu', '@adminUser', '@standardUser'] }, async ({ page, login }) => {
    await login();

    const prefPage = new PreferencesPagePo(page);

    await prefPage.goTo();
    await prefPage.waitForPage();

    const checkbox = prefPage.scalingDownPromptCheckbox();

    await expect(checkbox).toBeVisible();

    // Check the checkbox
    const prefUpdatePromise1 = page.waitForResponse(
      (resp) => resp.url().includes('v1/userpreferences/') && resp.request().method() === 'PUT'
    );

    await checkbox.click();

    const resp1 = await prefUpdatePromise1;

    expect(resp1.status()).toBe(200);

    const reqBody1 = resp1.request().postDataJSON();
    const respBody1 = await resp1.json();

    expect(reqBody1.data).toHaveProperty('scale-pool-prompt', 'true');
    expect(respBody1.data).toHaveProperty('scale-pool-prompt', 'true');

    // Uncheck the checkbox
    const prefUpdatePromise2 = page.waitForResponse(
      (resp) => resp.url().includes('v1/userpreferences/') && resp.request().method() === 'PUT'
    );

    await checkbox.click();

    const resp2 = await prefUpdatePromise2;

    expect(resp2.status()).toBe(200);

    const reqBody2 = resp2.request().postDataJSON();
    const respBody2 = await resp2.json();

    expect(reqBody2.data).toHaveProperty('scale-pool-prompt', 'false');
    expect(respBody2.data).toHaveProperty('scale-pool-prompt', 'false');
  });

  test('Can select Enable "View in API"', { tag: ['@userMenu', '@adminUser', '@standardUser'] }, async ({ page, login }) => {
    await login();

    const prefPage = new PreferencesPagePo(page);

    await prefPage.goTo();
    await prefPage.waitForPage();

    const viewInApiCheckbox = prefPage.viewInApiCheckbox();

    await expect(viewInApiCheckbox).toBeVisible();

    // Enable View in API
    const prefUpdatePromise1 = page.waitForResponse(
      (resp) => resp.url().includes('v1/userpreferences/') && resp.request().method() === 'PUT'
    );

    await viewInApiCheckbox.click();

    const resp1 = await prefUpdatePromise1;

    expect(resp1.status()).toBe(200);

    const reqBody1 = resp1.request().postDataJSON();
    const respBody1 = await resp1.json();

    expect(reqBody1.data).toHaveProperty('view-in-api', 'true');
    expect(respBody1.data).toHaveProperty('view-in-api', 'true');

    // Disable View in API
    await prefPage.goTo();
    await prefPage.waitForPage();
    await expect(viewInApiCheckbox).toBeVisible();

    const prefUpdatePromise2 = page.waitForResponse(
      (resp) => resp.url().includes('v1/userpreferences/') && resp.request().method() === 'PUT'
    );

    await viewInApiCheckbox.click();

    const resp2 = await prefUpdatePromise2;

    expect(resp2.status()).toBe(200);

    const reqBody2 = resp2.request().postDataJSON();
    const respBody2 = await resp2.json();

    expect(reqBody2.data).toHaveProperty('view-in-api', 'false');
    expect(respBody2.data).toHaveProperty('view-in-api', 'false');
  });

  test('Can select Show system Namespaces', { tag: ['@userMenu', '@adminUser', '@standardUser'] }, async ({ page, login }) => {
    await login();

    const prefPage = new PreferencesPagePo(page);

    await prefPage.goTo();
    await prefPage.waitForPage();

    const nsCheckbox = prefPage.allNamespacesCheckbox();

    await expect(nsCheckbox).toBeVisible();

    // Enable
    const prefUpdatePromise1 = page.waitForResponse(
      (resp) => resp.url().includes('v1/userpreferences/') && resp.request().method() === 'PUT'
    );

    await nsCheckbox.click();

    const resp1 = await prefUpdatePromise1;

    expect(resp1.status()).toBe(200);

    const reqBody1 = resp1.request().postDataJSON();
    const respBody1 = await resp1.json();

    expect(reqBody1.data).toHaveProperty('all-namespaces', 'true');
    expect(respBody1.data).toHaveProperty('all-namespaces', 'true');

    // Disable
    const prefUpdatePromise2 = page.waitForResponse(
      (resp) => resp.url().includes('v1/userpreferences/') && resp.request().method() === 'PUT'
    );

    await nsCheckbox.click();

    const resp2 = await prefUpdatePromise2;

    expect(resp2.status()).toBe(200);

    const reqBody2 = resp2.request().postDataJSON();
    const respBody2 = await resp2.json();

    expect(reqBody2.data).toHaveProperty('all-namespaces', 'false');
    expect(respBody2.data).toHaveProperty('all-namespaces', 'false');
  });

  test('Can select Enable Dark/Light Theme keyboard shortcut toggle', { tag: ['@userMenu', '@adminUser', '@standardUser'] }, async ({ page, login }) => {
    await login();

    const prefPage = new PreferencesPagePo(page);

    await prefPage.goTo();
    await prefPage.waitForPage();

    const themeShortcut = prefPage.themeShortcutCheckbox();

    await expect(themeShortcut).toBeVisible();

    // Enable
    const prefUpdatePromise1 = page.waitForResponse(
      (resp) => resp.url().includes('v1/userpreferences/') && resp.request().method() === 'PUT'
    );

    await themeShortcut.click();

    const resp1 = await prefUpdatePromise1;

    expect(resp1.status()).toBe(200);

    const reqBody1 = resp1.request().postDataJSON();
    const respBody1 = await resp1.json();

    expect(reqBody1.data).toHaveProperty('theme-shortcut', 'true');
    expect(respBody1.data).toHaveProperty('theme-shortcut', 'true');

    // Disable
    const prefUpdatePromise2 = page.waitForResponse(
      (resp) => resp.url().includes('v1/userpreferences/') && resp.request().method() === 'PUT'
    );

    await themeShortcut.click();

    const resp2 = await prefUpdatePromise2;

    expect(resp2.status()).toBe(200);

    const reqBody2 = resp2.request().postDataJSON();
    const respBody2 = await resp2.json();

    expect(reqBody2.data).toHaveProperty('theme-shortcut', 'false');
    expect(respBody2.data).toHaveProperty('theme-shortcut', 'false');
  });

  test('Can select a YAML Editor Key Mapping option', { tag: ['@userMenu', '@adminUser', '@standardUser'] }, async ({ page, login }) => {
    await login();

    const prefPage = new PreferencesPagePo(page);

    await prefPage.goTo();
    await prefPage.waitForPage();

    const keymapContainer = prefPage.keymapOptions();

    await expect(keymapContainer).toBeVisible();

    const buttonOptions: Record<string, string> = {
      Emacs:          'emacs',
      Vim:            'vim',
      'Normal human': 'sublime',
    };

    for (const [key, value] of Object.entries(buttonOptions)) {
      const prefUpdatePromise = page.waitForResponse(
        (resp) => resp.url().includes('v1/userpreferences/') && resp.request().method() === 'PUT'
      );

      await keymapContainer.getByRole('button', { name: key }).click();

      const resp = await prefUpdatePromise;

      expect(resp.status()).toBe(200);

      const reqBody = resp.request().postDataJSON();
      const respBody = await resp.json();

      expect(reqBody.data).toHaveProperty('keymap', value);
      expect(respBody.data).toHaveProperty('keymap', value);
    }
  });

  test('Can select a Helm Charts option', { tag: ['@userMenu', '@adminUser', '@standardUser'] }, async ({ page, login }) => {
    await login();

    const prefPage = new PreferencesPagePo(page);

    await prefPage.goTo();
    await prefPage.waitForPage();

    const helmContainer = prefPage.helmOptions();

    await expect(helmContainer).toBeVisible();

    const buttonOptions: Record<string, string> = {
      'Include Prerelease Versions': 'true',
      'Show Releases Only':          'false',
    };

    for (const [key, value] of Object.entries(buttonOptions)) {
      const prefUpdatePromise = page.waitForResponse(
        (resp) => resp.url().includes('v1/userpreferences/') && resp.request().method() === 'PUT'
      );

      await helmContainer.getByRole('button', { name: key }).click();

      const resp = await prefUpdatePromise;

      expect(resp.status()).toBe(200);

      const reqBody = resp.request().postDataJSON();
      const respBody = await resp.json();

      expect(reqBody.data).toHaveProperty('show-pre-release', value);
      expect(respBody.data).toHaveProperty('show-pre-release', value);
    }
  });

  test('Can select login landing page - home page', { tag: ['@userMenu', '@adminUser'] }, async ({ page, login, envMeta }) => {
    await login();

    const prefPage = new PreferencesPagePo(page);
    const userMenu = new UserMenuPo(page);

    await prefPage.goTo();
    await prefPage.waitForPage();

    const radioGroup = prefPage.landingPagePreference();

    await expect(radioGroup).toBeVisible();

    const prefUpdatePromise = page.waitForResponse(
      (resp) => resp.url().includes('v1/userpreferences/') && resp.request().method() === 'PUT'
    );

    // Select "Home" (index 0)
    await radioGroup.locator('.radio-label').nth(0).click();

    const resp = await prefUpdatePromise;

    expect(resp.status()).toBe(200);

    const reqBody = resp.request().postDataJSON();
    const respBody = await resp.json();

    expect(reqBody.data).toHaveProperty('after-login-route', '"home"');
    expect(respBody.data).toHaveProperty('after-login-route', '"home"');

    // Verify radio is checked
    await expect(radioGroup.locator('.radio-container > span').nth(0)).toHaveAttribute('aria-checked', 'true');

    // Logout and verify landing page
    await userMenu.clickMenuItem('Log Out');
    await expect(page).toHaveURL(/logged-out/);

    await login();
    await expect(page).toHaveURL(/\/home/);
  });

  test('Can select login landing page - last visited', { tag: ['@userMenu', '@adminUser'] }, async ({ page, login, envMeta }) => {
    await login();

    const prefPage = new PreferencesPagePo(page);
    const userMenu = new UserMenuPo(page);

    await prefPage.goTo();
    await prefPage.waitForPage();

    const radioGroup = prefPage.landingPagePreference();

    await expect(radioGroup).toBeVisible();

    const prefUpdatePromise = page.waitForResponse(
      (resp) => resp.url().includes('v1/userpreferences/') && resp.request().method() === 'PUT'
    );

    // Select "Last visited" (index 1)
    await radioGroup.locator('.radio-label').nth(1).click();

    const resp = await prefUpdatePromise;

    expect(resp.status()).toBe(200);

    const reqBody = resp.request().postDataJSON();
    const respBody = await resp.json();

    expect(reqBody.data).toHaveProperty('after-login-route', '"last-visited"');
    expect(respBody.data).toHaveProperty('after-login-route', '"last-visited"');

    // Verify radio is checked
    await expect(radioGroup.locator('.radio-container > span').nth(1)).toHaveAttribute('aria-checked', 'true');

    // Logout and verify landing page
    await userMenu.clickMenuItem('Log Out');
    await expect(page).toHaveURL(/logged-out/);

    await login();
    // "Last visited" should redirect to wherever user was before logout (prefs page)
    // Some Rancher versions redirect to prefs, others to the cluster explorer
    await expect(page).toHaveURL(/\/(prefs|c\/local)/);
  });

  test('Can select login landing page - specific cluster', { tag: ['@userMenu', '@adminUser'] }, async ({ page, login, envMeta }) => {
    await login();

    const prefPage = new PreferencesPagePo(page);
    const userMenu = new UserMenuPo(page);

    await prefPage.goTo();
    await prefPage.waitForPage();

    const radioGroup = prefPage.landingPagePreference();

    await expect(radioGroup).toBeVisible();

    // Ensure the cluster dropdown contains 'local' before selecting the radio
    await expect(prefPage.customPageOptions()).toContainText('local');

    const prefUpdatePromise = page.waitForResponse(
      (resp) => resp.url().includes('v1/userpreferences/') && resp.request().method() === 'PUT'
    );

    // Select "Specific cluster" (index 2)
    await radioGroup.locator('.radio-label').nth(2).click();

    const resp = await prefUpdatePromise;

    expect(resp.status()).toBe(200);

    const reqBody = resp.request().postDataJSON();
    const respBody = await resp.json();

    expect(reqBody.data).toHaveProperty('after-login-route', '{"name":"c-cluster","params":{"cluster":"local"}}');
    expect(respBody.data).toHaveProperty('after-login-route', '{"name":"c-cluster","params":{"cluster":"local"}}');

    // Verify radio is checked
    await expect(radioGroup.locator('.radio-container > span').nth(2)).toHaveAttribute('aria-checked', 'true');

    // Logout and verify landing page
    await userMenu.clickMenuItem('Log Out');
    await expect(page).toHaveURL(/logged-out/);

    await login();
    await expect(page).toHaveURL(/\/explore/);
  });
});
