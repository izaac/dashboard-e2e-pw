import { test, expect } from '@/support/fixtures';
import { RancherSetupLoginPagePo } from '@/e2e/po/pages/rancher-setup-login.po';
import { RancherSetupConfigurePage } from '@/e2e/po/pages/rancher-setup-configure.po';
import HomePagePo from '@/e2e/po/pages/home.po';
import { PARTIAL_SETTING_THRESHOLD } from '@/support/utils/settings-utils';
import { SHORT_TIMEOUT_OPT } from '@/support/utils/timeouts';

/**
 * Rancher setup — equivalent of cypress/e2e/tests/setup/rancher-setup.spec.ts
 *
 * Idempotent: safe to re-run against an already-bootstrapped Rancher.
 * Bootstrap tests skip when Rancher is already configured;
 * standard user creation skips when the user already exists.
 */
test.describe('Rancher setup', { tag: ['@setup', '@adminUserSetup', '@standardUserSetup'] }, () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ envMeta }) => {
    test.skip(!envMeta.bootstrapPassword, 'Requires CATTLE_BOOTSTRAP_PASSWORD');
  });

  test('Requires initial setup', async ({ page }) => {
    const homePage = new HomePagePo(page);
    const rancherSetupLoginPage = new RancherSetupLoginPagePo(page);

    await homePage.goTo();
    // SPA redirects unauthed users to /auth/login (both bootstrap and regular login use same URL)
    await expect(page).not.toHaveURL(/\/home/, { timeout: 10000 });

    // Username field only appears on the real login page, not the bootstrap page
    const usernameField = page.locator('[data-testid="local-login-username"]');

    if (await usernameField.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, 'Rancher already bootstrapped');
    }

    await rancherSetupLoginPage.waitForPage();
    await rancherSetupLoginPage.hasInfoMessage();
  });

  test('Confirm correct number of settings requests made', async ({ page, envMeta }) => {
    const settingsUrl = '**/v1/management.cattle.io.settings?exclude=metadata.managedFields';
    const rancherSetupLoginPage = new RancherSetupLoginPagePo(page);
    const rancherSetupConfigurePage = new RancherSetupConfigurePage(page);

    // Check if already bootstrapped — username field only exists on real login page
    await rancherSetupLoginPage.goTo();
    await page.waitForLoadState('domcontentloaded');

    const usernameField = page.locator('[data-testid="local-login-username"]');

    if (await usernameField.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, 'Rancher already bootstrapped');
    }

    // Collect settings responses
    const settingsResponses: any[] = [];

    await page.route(settingsUrl, async (route) => {
      const response = await route.fetch();
      const body = await response.json();

      settingsResponses.push(body);
      await route.fulfill({ response });
    });

    await rancherSetupLoginPage.goTo();

    // Wait for first settings request
    await page.waitForResponse((resp) => resp.url().includes('management.cattle.io.settings'));
    expect(settingsResponses[0].count).toBeLessThan(PARTIAL_SETTING_THRESHOLD);
    expect(settingsResponses).toHaveLength(1);

    await rancherSetupLoginPage.waitForPage();
    await rancherSetupLoginPage.bootstrapLogin(envMeta.bootstrapPassword!);

    // Wait for second settings request after login
    await page.waitForResponse((resp) => resp.url().includes('management.cattle.io.settings'));
    expect(settingsResponses[1].count).toBeGreaterThanOrEqual(PARTIAL_SETTING_THRESHOLD);

    await rancherSetupConfigurePage.waitForPage();

    // Ensure no additional requests are made
    await page.waitForTimeout(1000);
    expect(settingsResponses).toHaveLength(2);
  });

  test('Login & Configure', async ({ page, envMeta }) => {
    const rancherSetupLoginPage = new RancherSetupLoginPagePo(page);
    const rancherSetupConfigurePage = new RancherSetupConfigurePage(page);

    await rancherSetupLoginPage.goTo();
    await page.waitForLoadState('domcontentloaded');

    // Username field only exists on real login page, not bootstrap page
    const usernameField = page.locator('[data-testid="local-login-username"]');

    if (await usernameField.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, 'Rancher already bootstrapped');
    }

    // Intercept bootstrap login
    const loginPromise = page.waitForResponse('**/v1-public/login');

    await rancherSetupLoginPage.waitForPage();
    await rancherSetupLoginPage.bootstrapLogin(envMeta.bootstrapPassword!);

    const loginResp = await loginPromise;

    expect(loginResp.status()).toBe(200);

    await rancherSetupConfigurePage.waitForPage();
    expect(await rancherSetupConfigurePage.canSubmit()).toBe(false);

    // Check server URL is visible
    await rancherSetupConfigurePage.serverUrl().checkVisible();

    // Accept terms and submit
    await rancherSetupConfigurePage.setTermsAgreement();
    expect(await rancherSetupConfigurePage.canSubmit()).toBe(true);
    await rancherSetupConfigurePage.submit();

    // Wait for first login preferences
    const prefsPromise = page.waitForResponse('**/v1/userpreferences/*');

    await expect(page).toHaveURL(/\/home/, SHORT_TIMEOUT_OPT);

    const prefsResp = await prefsPromise;

    expect(prefsResp.status()).toBe(200);
  });

  test('Create standard user', async ({ rancherApi, envMeta }) => {
    // Re-login — the worker-scoped rancherApi token may have been invalidated by bootstrap
    await rancherApi.login(envMeta.username, envMeta.password);

    // Check if standard_user already exists
    const usersResp = await rancherApi.getRancherResource('v1', 'management.cattle.io.users');
    const existingUser = usersResp.body.data.find((u: { username?: string }) => u.username?.includes('standard_user'));

    if (existingUser) {
      test.skip(true, 'Standard user already exists');
    }

    await rancherApi.createUser(
      {
        username: 'standard_user',
        globalRole: { role: 'user' },
        projectRole: {
          clusterId: 'local',
          projectName: 'Default',
          role: 'project-member',
        },
        password: envMeta.password,
      },
      { createNameOptions: { onlyContext: true } },
    );
  });
});
