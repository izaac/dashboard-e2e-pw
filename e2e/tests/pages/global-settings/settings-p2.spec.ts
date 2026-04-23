import { test, expect } from '@/support/fixtures';
import { SettingsPagePo } from '@/e2e/po/pages/global-settings/settings.po';
import HomePagePo from '@/e2e/po/pages/home.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';

const settingsData: Record<string, { new: string; new2?: string; new3?: string }> = {
  'ui-index': { new: 'https://my-custom-ui.example.com/latest/index.html' },
  'ui-dashboard-index': { new: 'https://my-custom-ui.example.com/dashboard/index.html' },
  'ui-offline-preferred': { new: 'Local', new2: 'Remote', new3: 'Dynamic' },
  'ui-brand': { new: 'suse' },
  'hide-local-cluster': { new: 'true' },
  'k3s-based-upgrader-uninstall-concurrency': { new: '3' },
  'system-agent-upgrader-install-concurrency': { new: '3' },
  'system-default-registry': { new: 'docker.io' },
};

const serverUrlLocalhostCases = [
  'http://LOCALhosT:8005',
  'http://localhost:8005',
  'https://localhost:8005',
  'localhost',
  'http://127.0.0.1',
  'https://127.0.0.1',
  '127.0.0.1',
];

const urlWithTrailingForwardSlash = 'https://test.com/';
const httpUrl = 'http://test.com';
const nonUrlCases = ['test', 'https', 'test.com', 'a.test.com'];

const settingsClusterId = '_';

test.describe('Settings (Part 2)', () => {
  test.describe.configure({ mode: 'serial' });
  // Serial: tests mutate global singleton settings on a shared Rancher instance
  let settingsPage: SettingsPagePo;

  test.beforeEach(async ({ login, page }) => {
    await login();
    settingsPage = new SettingsPagePo(page, settingsClusterId);
  });

  /** Snapshot a setting and return a restore function (handles resourceVersion refresh) */
  async function snapshotSetting(rancherApi: any, name: string) {
    const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', name);
    const original = structuredClone(resp.body);

    return async () => {
      const fresh = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', name);

      original.metadata.resourceVersion = fresh.body.metadata.resourceVersion;
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', name, original);
    };
  }

  async function navToSettings(page: any) {
    const burgerMenu = new BurgerMenuPo(page);
    const sideNav = new ProductNavPo(page);

    await burgerMenu.toggle();
    await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
    // Guard: wait for navigation + Vue render (cluster context may be local or _)
    await settingsPage.waitForUrlPathWithoutContext();
    await settingsPage.waitForDashboardRoot();
    await sideNav.navToSideMenuEntryByLabel('Settings');
  }

  async function editSetting(page: any, settingName: string) {
    await settingsPage.actionButtonByLabel(settingName).click();
    await settingsPage.editSettingsButton().click();
    await expect(page).toHaveURL(new RegExp(settingName));
  }

  test('can update but not reset server-url', { tag: ['@globalSettings', '@adminUser'] }, async ({ page }) => {
    await navToSettings(page);

    const serverUrlLocator = settingsPage.settingsValue('server-url');

    await expect(serverUrlLocator).toBeVisible();
    const serverUrlValue = (await serverUrlLocator.textContent()) ?? '';

    await editSetting(page, 'server-url');

    await expect(settingsPage.settingTitle()).toContainText('Setting: server-url');

    // Save without changing the value
    const saveResponsePromise = page.waitForResponse(
      (resp: any) => resp.url().includes('server-url') && resp.request().method() === 'PUT',
    );

    await settingsPage.saveButton().click();
    await saveResponsePromise;

    await expect(settingsPage.advancedSettingRow('server-url')).toContainText(serverUrlValue.trim());

    // Check reset button is disabled
    await navToSettings(page);
    await editSetting(page, 'server-url');

    await expect(settingsPage.settingTitle()).toContainText('Setting: server-url');
    const useDefaultBtn = settingsPage.useDefaultButton();

    await expect(useDefaultBtn).toBeVisible();
    await expect(useDefaultBtn).toBeDisabled();
  });

  test('can validate server-url', { tag: ['@globalSettings', '@adminUser'] }, async ({ page }) => {
    await navToSettings(page);
    await editSetting(page, 'server-url');

    await expect(settingsPage.settingTitle()).toContainText('Setting: server-url');

    const input = settingsPage.settingInput();

    // Check showing localhost warning banner
    for (const url of serverUrlLocalhostCases) {
      await input.fill(url);
      await expect(settingsPage.serverUrlLocalhostWarningBanner()).toBeVisible();
    }

    // Check showing error banner when the url has trailing forward slash
    await input.fill(urlWithTrailingForwardSlash);
    await expect(
      settingsPage.errorBanner().filter({ hasText: 'Server URL should not have a trailing forward slash' }),
    ).toBeVisible();

    // Check showing error banner when the url is not HTTPS
    await input.fill(httpUrl);
    await expect(settingsPage.errorBanner().filter({ hasText: 'Server URL must be https' })).toBeVisible();

    // Check showing error banner when the input value is not a url
    for (const inputValue of nonUrlCases) {
      await input.fill(inputValue);
      await expect(settingsPage.errorBanner().filter({ hasText: 'Server URL must be an URL' })).toBeVisible();
      await expect(settingsPage.errorBanner().filter({ hasText: 'Server URL must be https' })).toBeVisible();
    }
  });

  test('can update ui-index', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, rancherApi }) => {
    const settingName = 'ui-index';
    const restore = await snapshotSetting(rancherApi, settingName);

    try {
      await navToSettings(page);
      await editSetting(page, settingName);

      await expect(settingsPage.settingTitle()).toContainText(`Setting: ${settingName}`);

      const input = settingsPage.settingInput();

      await input.clear();
      await input.fill(settingsData[settingName].new);

      const saveResponsePromise = page.waitForResponse(
        (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
      );

      await settingsPage.saveButton().click();
      const saveResp = await saveResponsePromise;

      expect(saveResp.status()).toBe(200);
      expect(saveResp.request().postDataJSON().value).toBe(settingsData[settingName].new);

      await expect(settingsPage.advancedSettingRow(settingName)).toContainText(settingsData[settingName].new);

      // Reset via UI
      await navToSettings(page);
      await editSetting(page, settingName);

      await settingsPage.useDefaultButton().click();
      const resetResponsePromise = page.waitForResponse(
        (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
      );

      await settingsPage.saveButton().click();
      const resetResp = await resetResponsePromise;

      expect(resetResp.status()).toBe(200);

      const defaultVal = (await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', settingName)).body
        .default;

      await expect(settingsPage.advancedSettingRow(settingName)).toContainText(defaultVal);
    } finally {
      await restore();
    }
  });

  test('can update ui-dashboard-index', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, rancherApi }) => {
    const settingName = 'ui-dashboard-index';
    const restore = await snapshotSetting(rancherApi, settingName);

    try {
      await navToSettings(page);
      await editSetting(page, settingName);

      await expect(settingsPage.settingTitle()).toContainText(`Setting: ${settingName}`);

      const input = settingsPage.settingInput();

      await input.clear();
      await input.fill(settingsData[settingName].new);

      const saveResponsePromise = page.waitForResponse(
        (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
      );

      await settingsPage.saveButton().click();
      const saveResp = await saveResponsePromise;

      expect(saveResp.status()).toBe(200);
      expect(saveResp.request().postDataJSON().value).toBe(settingsData[settingName].new);

      await expect(settingsPage.advancedSettingRow(settingName)).toContainText(settingsData[settingName].new);

      // Reset via UI
      await navToSettings(page);
      await editSetting(page, settingName);

      await settingsPage.useDefaultButton().click();
      const resetResponsePromise = page.waitForResponse(
        (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
      );

      await settingsPage.saveButton().click();
      const resetResp = await resetResponsePromise;

      expect(resetResp.status()).toBe(200);

      const defaultVal = (await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', settingName)).body
        .default;

      await expect(settingsPage.advancedSettingRow(settingName)).toContainText(defaultVal);
    } finally {
      await restore();
    }
  });

  test('can update ui-offline-preferred', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, rancherApi }) => {
    const settingName = 'ui-offline-preferred';
    const restore = await snapshotSetting(rancherApi, settingName);

    try {
      // Update setting: Local
      await navToSettings(page);
      await editSetting(page, settingName);

      await expect(settingsPage.settingTitle()).toContainText(`Setting: ${settingName}`);

      const select = settingsPage.unlabeledSelect();

      await select.toggle();
      await select.clickOptionWithLabel('Local');

      let saveResponsePromise = page.waitForResponse(
        (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
      );

      await settingsPage.saveButton().click();
      let saveResp = await saveResponsePromise;

      expect(saveResp.status()).toBe(200);
      expect(saveResp.request().postDataJSON().value).toBe('true');

      await expect(settingsPage.advancedSettingRow(settingName)).toContainText('Local');

      // Update settings: Remote
      await navToSettings(page);
      await editSetting(page, settingName);

      await select.toggle();
      await select.clickOptionWithLabel('Remote');

      saveResponsePromise = page.waitForResponse(
        (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
      );

      await settingsPage.saveButton().click();
      saveResp = await saveResponsePromise;

      expect(saveResp.status()).toBe(200);
      expect(saveResp.request().postDataJSON().value).toBe('false');

      await expect(settingsPage.advancedSettingRow(settingName)).toContainText('Remote');

      // Update settings: Dynamic
      await navToSettings(page);
      await editSetting(page, settingName);

      await select.toggle();
      await select.clickOptionWithLabel('Dynamic');

      saveResponsePromise = page.waitForResponse(
        (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
      );

      await settingsPage.saveButton().click();
      saveResp = await saveResponsePromise;

      expect(saveResp.status()).toBe(200);
      expect(saveResp.request().postDataJSON().value).toBe('dynamic');

      await expect(settingsPage.advancedSettingRow(settingName)).toContainText('Dynamic');

      // Reset via UI
      await navToSettings(page);
      await editSetting(page, settingName);

      await settingsPage.useDefaultButton().click();
      const resetResponsePromise = page.waitForResponse(
        (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
      );

      await settingsPage.saveButton().click();
      const resetResp = await resetResponsePromise;

      expect(resetResp.status()).toBe(200);

      // Verify visual display matches the default value (upstream parity)
      const defaultValue = resetResp.request().postDataJSON().value;
      let visualDefault = 'Dynamic';

      if (defaultValue === 'true') {
        visualDefault = 'Local';
      } else if (defaultValue === 'false') {
        visualDefault = 'Remote';
      }

      await expect(settingsPage.advancedSettingRow(settingName)).toContainText(visualDefault);
    } finally {
      await restore();
    }
  });

  test('can update ui-brand', { tag: ['@noPrime', '@globalSettings', '@adminUser'] }, async ({ page, rancherApi }) => {
    const settingName = 'ui-brand';
    const burgerMenu = new BurgerMenuPo(page);
    const restore = await snapshotSetting(rancherApi, settingName);

    try {
      await navToSettings(page);
      await editSetting(page, settingName);

      await expect(settingsPage.settingTitle()).toContainText(`Setting: ${settingName}`);

      const input = settingsPage.settingInput();

      await input.clear();
      await input.fill(settingsData[settingName].new);

      const saveResponsePromise = page.waitForResponse(
        (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
      );

      await settingsPage.saveButton().click();
      await saveResponsePromise;

      await expect(settingsPage.advancedSettingRow(settingName)).toContainText(settingsData[settingName].new);

      // Check logos in top-level navigation header for updated logo
      await burgerMenu.toggle();
      await expect(burgerMenu.brandLogoImage()).toBeVisible();
      const suseLogoWidth = await burgerMenu.brandLogoImage().evaluate((el) => el.getBoundingClientRect().width);

      expect(suseLogoWidth).toBeGreaterThanOrEqual(198);
      expect(suseLogoWidth).toBeLessThanOrEqual(202);
      await burgerMenu.toggle();

      // Reset via UI
      await navToSettings(page);
      await editSetting(page, settingName);

      await settingsPage.useDefaultButton().click();
      const resetResponsePromise = page.waitForResponse(
        (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
      );

      await settingsPage.saveButton().click();
      await resetResponsePromise;

      await expect(settingsPage.advancedSettingRow(settingName)).not.toContainText(settingsData[settingName].new);

      // Check side menu logo reverted to default Rancher width (upstream parity)
      await burgerMenu.toggle();
      await expect(burgerMenu.brandLogoImage()).toBeVisible();
      const sideDefaultWidth = await burgerMenu.brandLogoImage().evaluate((el) => el.getBoundingClientRect().width);

      expect(sideDefaultWidth).toBeGreaterThanOrEqual(165);
      expect(sideDefaultWidth).toBeLessThanOrEqual(170);
    } finally {
      await restore();
    }
  });

  test('can update hide-local-cluster', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, rancherApi }) => {
    const settingName = 'hide-local-cluster';
    const restore = await snapshotSetting(rancherApi, settingName);

    try {
      await navToSettings(page);
      await editSetting(page, settingName);

      await expect(settingsPage.settingTitle()).toContainText(`Setting: ${settingName}`);

      // Set radio button to "true" (first option)
      await settingsPage.radioButton(0).click();

      const saveResponsePromise = page.waitForResponse(
        (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
      );

      await settingsPage.saveButton().click();
      await saveResponsePromise;

      await expect(settingsPage.advancedSettingRow(settingName)).toContainText('true');

      // Check home page for local cluster
      const burgerMenu = new BurgerMenuPo(page);

      await burgerMenu.toggle();
      await burgerMenu.burgerMenuNavToMenuByLabel('Home');
      const homePage = new HomePagePo(page);

      await expect(homePage.body()).not.toContainText('local');

      // Reset via UI
      await navToSettings(page);
      await editSetting(page, settingName);

      // Set radio button to "false" (second option)
      await settingsPage.radioButton(1).click();
      const resetResponsePromise = page.waitForResponse(
        (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
      );

      await settingsPage.saveButton().click();
      await resetResponsePromise;

      const defaultVal = (await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', settingName)).body
        .default;

      await expect(settingsPage.advancedSettingRow(settingName)).toContainText(defaultVal);
    } finally {
      await restore();
    }
  });

  test(
    'can update k3s-based-upgrader-uninstall-concurrency',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      const settingName = 'k3s-based-upgrader-uninstall-concurrency';
      const restore = await snapshotSetting(rancherApi, settingName);

      try {
        await navToSettings(page);
        await editSetting(page, settingName);

        await expect(settingsPage.settingTitle()).toContainText(`Setting: ${settingName}`);

        const input = settingsPage.settingInput();

        await input.clear();
        await input.fill(settingsData[settingName].new);

        const saveResponsePromise = page.waitForResponse(
          (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
        );

        await settingsPage.saveButton().click();
        const saveResp = await saveResponsePromise;

        expect(saveResp.status()).toBe(200);
        expect(saveResp.request().postDataJSON().value).toBe(settingsData[settingName].new);

        await expect(settingsPage.advancedSettingRow(settingName)).toContainText(settingsData[settingName].new);

        // Reset via UI
        await navToSettings(page);
        await editSetting(page, settingName);

        await settingsPage.useDefaultButton().click();
        const resetResponsePromise = page.waitForResponse(
          (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
        );

        await settingsPage.saveButton().click();
        const resetResp = await resetResponsePromise;

        expect(resetResp.status()).toBe(200);

        const defaultVal = (await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', settingName))
          .body.default;

        await expect(settingsPage.advancedSettingRow(settingName)).toContainText(defaultVal);
      } finally {
        await restore();
      }
    },
  );

  test(
    'can update system-agent-upgrader-install-concurrency',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      const settingName = 'system-agent-upgrader-install-concurrency';
      const restore = await snapshotSetting(rancherApi, settingName);

      try {
        await navToSettings(page);
        await editSetting(page, settingName);

        await expect(settingsPage.settingTitle()).toContainText(`Setting: ${settingName}`);

        const input = settingsPage.settingInput();

        await input.clear();
        await input.fill(settingsData[settingName].new);

        const saveResponsePromise = page.waitForResponse(
          (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
        );

        await settingsPage.saveButton().click();
        const saveResp = await saveResponsePromise;

        expect(saveResp.status()).toBe(200);
        expect(saveResp.request().postDataJSON().value).toBe(settingsData[settingName].new);

        await expect(settingsPage.advancedSettingRow(settingName)).toContainText(settingsData[settingName].new);

        // Reset via UI
        await navToSettings(page);
        await editSetting(page, settingName);

        await settingsPage.useDefaultButton().click();
        const resetResponsePromise = page.waitForResponse(
          (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
        );

        await settingsPage.saveButton().click();
        const resetResp = await resetResponsePromise;

        expect(resetResp.status()).toBe(200);

        const defaultVal = (await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', settingName))
          .body.default;

        await expect(settingsPage.advancedSettingRow(settingName)).toContainText(defaultVal);
      } finally {
        await restore();
      }
    },
  );

  test(
    'can update system-default-registry',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      const settingName = 'system-default-registry';
      const restore = await snapshotSetting(rancherApi, settingName);

      try {
        await navToSettings(page);
        await editSetting(page, settingName);

        await expect(settingsPage.settingTitle()).toContainText(`Setting: ${settingName}`);

        const input = settingsPage.settingInput();

        await input.clear();
        await input.fill(settingsData[settingName].new);

        const saveResponsePromise = page.waitForResponse(
          (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
        );

        await settingsPage.saveButton().click();
        await saveResponsePromise;

        await expect(settingsPage.advancedSettingRow(settingName)).toContainText(settingsData[settingName].new);

        // Reset via UI
        await navToSettings(page);
        await editSetting(page, settingName);

        await input.clear();
        const resetResponsePromise = page.waitForResponse(
          (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
        );

        await settingsPage.saveButton().click();
        await resetResponsePromise;
      } finally {
        await restore();
      }
    },
  );
});

test.describe('Settings (Part 2) - Standard User', { tag: ['@globalSettings', '@standardUser'] }, () => {
  test('standard user has only read access to Settings page', async ({ page, login, envMeta }) => {
    await login({ username: 'standard_user', password: envMeta.password });

    const settingsPage = new SettingsPagePo(page, '_');
    const burgerMenu = new BurgerMenuPo(page);
    const sideNav = new ProductNavPo(page);

    await burgerMenu.toggle();
    await burgerMenu.burgerMenuNavToMenuByLabel('Global Settings');
    await sideNav.navToSideMenuEntryByLabel('Settings');

    await expect(settingsPage.actionButtonByLabel('password-min-length')).not.toBeAttached();
  });
});
