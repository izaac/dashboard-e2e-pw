import { test, expect } from '@/support/fixtures';
import { SettingsPagePo } from '@/e2e/po/pages/global-settings/settings.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';
import { VERY_LONG, EXTRA_LONG } from '@/support/timeouts';

const BANNER_TEXT =
  "Typical users will not need to change these. Proceed with caution, incorrect values can break your Explorer installation. Settings which have been customized from default settings are tagged 'Modified'.";

// Settings data (matches Cypress blueprint)
const settingsData: Record<string, { new: string; new2?: string; new3?: string }> = {
  'engine-iso-url': { new: 'https://my.custom.url/custom-v1.24.iso' },
  'password-min-length': { new: '20' },
  'ingress-ip-domain': { new: 'test.sslip.io' },
  'auth-user-info-max-age-seconds': { new: '3601' },
  'auth-user-session-ttl-minutes': { new: '961' },
  'auth-token-max-ttl-minutes': { new: '10' },
  'auth-user-session-idle-ttl-minutes': { new: '1' },
  'kubeconfig-default-token-ttl-minutes': { new: '2881' },
  'auth-user-info-resync-cron': { new: '0 0 * * 0' },
  'kubeconfig-generate-token': { new: 'false' },
  'agent-tls-mode': { new: 'System Store' },
  'k3s-based-upgrader-uninstall-concurrency': { new: '3' },
  'system-agent-upgrader-install-concurrency': { new: '3' },
  'system-default-registry': { new: 'docker.io' },
};

const settingsClusterId = '_';

test.describe('Settings', () => {
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
    // Click the action button for the setting
    await settingsPage.actionButtonByLabel(settingName).click();
    await settingsPage.editSettingsButton().click();

    // Wait for edit page
    await expect(page).toHaveURL(new RegExp(settingName));
  }

  test(
    'Inactivity modal: can update auth-user-session-idle-ttl-minutes and show modal',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      test.setTimeout(EXTRA_LONG);
      const sessionIdleSetting = 'auth-user-session-idle-ttl-minutes';
      const sessionTtlSetting = 'auth-user-session-ttl-minutes';

      const restoreIdle = await snapshotSetting(rancherApi, sessionIdleSetting);
      const restoreTtl = await snapshotSetting(rancherApi, sessionTtlSetting);

      try {
        // Precondition: session TTL must be >= idle TTL, otherwise admission webhook rejects
        const ttlResp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', sessionTtlSetting);
        const currentTtl = parseInt(ttlResp.body.value || ttlResp.body.default || '960', 10);

        if (currentTtl < 2) {
          ttlResp.body.value = '960';
          await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', sessionTtlSetting, ttlResp.body);
        }

        // Navigate to settings and edit the idle TTL
        await navToSettings(page);
        await editSetting(page, sessionIdleSetting);
        await expect(settingsPage.settingTitle()).toContainText(`Setting: ${sessionIdleSetting}`);

        await settingsPage.settingInput().clear();
        await settingsPage.settingInput().fill(settingsData[sessionIdleSetting].new);

        // Intercept ALL useractivities requests with a fixed expiresAt.
        // Must be fixed (not dynamic) so the frontend countdown approaches zero.
        // Must override ALL calls because Playwright keeps the page live (unlike Cypress cy.wait).
        const expiresAt = new Date(Date.now() + VERY_LONG).toISOString();

        await page.route('**/v1/ext.cattle.io.useractivities/*', async (route) => {
          const fetchResp = await route.fetch();

          if (fetchResp.status() !== 200) {
            await route.fulfill({ response: fetchResp });

            return;
          }

          const body = await fetchResp.json();

          if (body.status?.expiresAt) {
            body.status.expiresAt = expiresAt;
          }

          await route.fulfill({ response: fetchResp, json: body });
        });

        try {
          // Save the setting
          const saveResponse = page.waitForResponse(
            (resp) =>
              resp.url().includes('management.cattle.io.settings') &&
              resp.url().includes(sessionIdleSetting) &&
              resp.request().method() === 'PUT',
          );

          await settingsPage.saveButton().click();
          const resp = await saveResponse;

          expect(resp.status()).toBe(200);

          // Verify the saved value shows in the list
          await expect(settingsPage.settingsValue(sessionIdleSetting)).toContainText(
            settingsData[sessionIdleSetting].new,
          );

          // Wait for the inactivity modal to appear (frontend shows it when expiresAt is near)
          const modal = settingsPage.inactivityModalCard();

          await expect(modal).toBeVisible({ timeout: VERY_LONG });
          await expect(modal).toContainText('Session expiring');
          await expect(modal).toContainText('Your session is about to expire due to inactivity');
          await expect(modal).toContainText('Resume Session');

          // Click "Resume Session" to dismiss — use force because modal overlay can intercept
          await settingsPage.resumeSessionButton().click({ force: true });
          await expect(modal).toBeHidden();

          // Navigate away and let any in-flight idle-timer logic settle — the
          // modal can flicker on SPA re-render before the resumed session
          // re-arms. networkidle gives a deterministic settle point so the
          // hidden assertion is a true snapshot rather than a polling race.
          await page.goto('./home', { waitUntil: 'domcontentloaded' });
          // eslint-disable-next-line playwright/no-networkidle -- intentional: deterministic settle for the post-resume modal-hidden assertion
          await page.waitForLoadState('networkidle');
          await expect(modal).toBeHidden();
        } finally {
          await page.unroute('**/v1/ext.cattle.io.useractivities/*');
        }
      } finally {
        await Promise.allSettled([restoreIdle(), restoreTtl()]);
      }
    },
  );

  test('has the correct title', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, rancherApi }) => {
    const restorePl = await snapshotSetting(rancherApi, 'ui-pl');

    try {
      // Ensure private label is at default (may be left over from branding test)
      const plResp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-pl');

      if (plResp.body.value && plResp.body.value !== plResp.body.default) {
        plResp.body.value = plResp.body.default;
        await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-pl', plResp.body);
      }

      await navToSettings(page);

      const version = await rancherApi.getRancherVersion();
      const expectedTitle =
        version.RancherPrime === 'true'
          ? 'Rancher Prime - Global Settings - Settings'
          : 'Rancher - Global Settings - Settings';

      await expect(page).toHaveTitle(expectedTitle);
    } finally {
      await restorePl();
    }
  });

  test('has the correct banner text', { tag: ['@globalSettings', '@adminUser'] }, async ({ page }) => {
    await navToSettings(page);
    await expect(settingsPage.banner()).toContainText(BANNER_TEXT);
  });

  test('can update engine-iso-url', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, rancherApi }) => {
    const settingName = 'engine-iso-url';
    const restore = await snapshotSetting(rancherApi, settingName);

    try {
      await navToSettings(page);
      await editSetting(page, settingName);

      await expect(settingsPage.settingTitle()).toContainText(`Setting: ${settingName}`);

      // Update
      const input = settingsPage.settingInput();

      await input.clear();
      await input.fill(settingsData[settingName].new);

      const saveResponsePromise = page.waitForResponse(
        (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
      );

      await settingsPage.saveButton().click();
      const saveResp = await saveResponsePromise;

      expect(saveResp.status()).toBe(200);
      const reqBody = saveResp.request().postDataJSON();

      expect(reqBody.value).toBe(settingsData[settingName].new);

      // Verify value shown
      await expect(settingsPage.advancedSettingRow(settingName)).toContainText(settingsData[settingName].new);

      // Check modified label
      await settingsPage.scrollToBottom();
      await expect(settingsPage.modifiedLabel(settingName)).toBeVisible();

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

      await expect(settingsPage.advancedSettingRow(settingName)).toContainText(
        (await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', settingName)).body.default,
      );
      await expect(settingsPage.modifiedLabel(settingName)).not.toBeAttached();
    } finally {
      await restore();
    }
  });

  test('can update password-min-length', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, rancherApi }) => {
    const settingName = 'password-min-length';
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

      await settingsPage.useDefaultButton().click();

      const resetResponsePromise = page.waitForResponse(
        (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
      );

      await settingsPage.saveButton().click();
      await resetResponsePromise;

      const freshDefault = (await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', settingName))
        .body.default;

      await expect(settingsPage.advancedSettingRow(settingName)).toContainText(freshDefault);
    } finally {
      await restore();
    }
  });

  test('can update ingress-ip-domain', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, rancherApi }) => {
    const settingName = 'ingress-ip-domain';
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

      const freshDefault = (await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', settingName))
        .body.default;

      await expect(settingsPage.advancedSettingRow(settingName)).toContainText(freshDefault);
    } finally {
      await restore();
    }
  });

  test(
    'can update auth-user-info-max-age-seconds',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      const settingName = 'auth-user-info-max-age-seconds';
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

        const freshDefault = (await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', settingName))
          .body.default;

        await expect(settingsPage.advancedSettingRow(settingName)).toContainText(freshDefault);
      } finally {
        await restore();
      }
    },
  );

  test(
    'can update auth-user-session-ttl-minutes',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      const settingName = 'auth-user-session-ttl-minutes';
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

        const freshDefault = (await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', settingName))
          .body.default;

        await expect(settingsPage.advancedSettingRow(settingName)).toContainText(freshDefault);
      } finally {
        await restore();
      }
    },
  );

  test(
    'can update auth-token-max-ttl-minutes',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      const settingName = 'auth-token-max-ttl-minutes';
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

        await settingsPage.useDefaultButton().click();
        const resetResponsePromise = page.waitForResponse(
          (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
        );

        await settingsPage.saveButton().click();
        await resetResponsePromise;

        const freshDefault = (await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', settingName))
          .body.default;

        await expect(settingsPage.advancedSettingRow(settingName)).toContainText(freshDefault);
      } finally {
        await restore();
      }
    },
  );

  test(
    'can update kubeconfig-default-token-ttl-minutes',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      const settingName = 'kubeconfig-default-token-ttl-minutes';
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

        const freshDefault = (await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', settingName))
          .body.default;

        await expect(settingsPage.advancedSettingRow(settingName)).toContainText(freshDefault);
      } finally {
        await restore();
      }
    },
  );

  test(
    'can update auth-user-info-resync-cron',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      const settingName = 'auth-user-info-resync-cron';
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

        const freshDefault = (await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', settingName))
          .body.default;

        await expect(settingsPage.advancedSettingRow(settingName)).toContainText(freshDefault);
      } finally {
        await restore();
      }
    },
  );

  test(
    'can update kubeconfig-generate-token',
    { tag: ['@globalSettings', '@adminUser'] },
    async ({ page, rancherApi }) => {
      const settingName = 'kubeconfig-generate-token';
      const restore = await snapshotSetting(rancherApi, settingName);

      try {
        await navToSettings(page);
        await editSetting(page, settingName);

        await expect(settingsPage.settingTitle()).toContainText(`Setting: ${settingName}`);

        // Set radio button to "false"
        await settingsPage.radioButton(1).click();

        const saveResponsePromise = page.waitForResponse(
          (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
        );

        await settingsPage.saveButton().click();
        await saveResponsePromise;

        await expect(settingsPage.advancedSettingRow(settingName)).toContainText(settingsData[settingName].new);

        // Reset via UI
        await navToSettings(page);
        await editSetting(page, settingName);

        await settingsPage.useDefaultButton().click();
        const resetResponsePromise = page.waitForResponse(
          (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
        );

        await settingsPage.saveButton().click();
        await resetResponsePromise;

        const freshDefault = (await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', settingName))
          .body.default;

        await expect(settingsPage.advancedSettingRow(settingName)).toContainText(freshDefault);

        // Validate kubeconfig YAML structure (upstream parity)
        const kcResp = await rancherApi.createRancherResource('v1', 'ext.cattle.io.kubeconfigs', {
          metadata: {},
          spec: { clusterName: 'local' },
        });

        expect(kcResp.status).toBe(201);
        const jsyaml = await import('js-yaml');
        const kubeconfig = jsyaml.load(kcResp.body.status.value) as Record<string, unknown>;

        expect(kubeconfig).toHaveProperty('apiVersion', 'v1');
        expect(kubeconfig).toHaveProperty('kind', 'Config');
        expect((kubeconfig.clusters as Array<{ name: string }>).length).toBeGreaterThanOrEqual(1);
        expect((kubeconfig.users as Array<{ user: { token: string } }>)[0].user.token.length).toBeGreaterThan(0);
      } finally {
        await restore();
      }
    },
  );

  test('can update agent-tls-mode', { tag: ['@globalSettings', '@adminUser'] }, async ({ page, rancherApi }) => {
    const settingName = 'agent-tls-mode';

    // Webhook can reject agent-tls-mode changes for multiple reasons (downstream cluster health,
    // AgentConnectCheck conditions, etc). Probe with a no-op PUT to verify the webhook allows changes.
    const current = await rancherApi.getRancherResource('v1', `management.cattle.io.settings`, settingName);
    const probeResp = await rancherApi.setRancherResource(
      'v1',
      'management.cattle.io.settings',
      settingName,
      { ...current.body, value: current.body.value || current.body.default },
      false,
    );

    test.skip(probeResp.status !== 200, `Webhook rejects agent-tls-mode changes (${probeResp.status})`);

    const restore = await snapshotSetting(rancherApi, settingName);

    try {
      await navToSettings(page);
      await editSetting(page, settingName);

      await expect(settingsPage.settingTitle()).toContainText(`Setting: ${settingName}`);

      // Select "System Store" from dropdown
      const select = settingsPage.unlabeledSelect();

      await select.dropdown().click();
      await select.clickOptionWithLabel('System Store');

      const saveResponsePromise = page.waitForResponse(
        (resp: any) => resp.url().includes(settingName) && resp.request().method() === 'PUT',
      );

      await settingsPage.saveButton().click();
      await saveResponsePromise;

      await expect(settingsPage.advancedSettingRow(settingName)).toContainText('System Store');

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

      const freshDefault = (await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', settingName))
        .body.default;

      expect(resetResp.request().postDataJSON().value).toBe(freshDefault);
    } finally {
      await restore();
    }
  });
});

test.describe('Settings - Standard User', { tag: ['@globalSettings', '@standardUser'] }, () => {
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
