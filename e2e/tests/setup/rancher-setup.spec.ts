import { test, expect } from '@/support/fixtures';
import { RancherSetupLoginPagePo } from '@/e2e/po/pages/rancher-setup-login.po';
import { RancherSetupConfigurePage } from '@/e2e/po/pages/rancher-setup-configure.po';
import HomePagePo from '@/e2e/po/pages/home.po';
import { PARTIAL_SETTING_THRESHOLD } from '@/support/utils/settings-utils';
import { SHORT_TIMEOUT_OPT } from '@/support/utils/timeouts';
import { BRIEF, EXTENDED, STANDARD } from '@/support/timeouts';

/**
 * Rancher setup — equivalent of cypress/e2e/tests/setup/rancher-setup.spec.ts
 *
 * Handles three bootstrap scenarios:
 *   1. Fresh Rancher (no CATTLE_BOOTSTRAP_PASSWORD) → /auth/login bootstrap page
 *   2. CATTLE_BOOTSTRAP_PASSWORD set → /auth/setup directly (login skipped)
 *   3. Already fully bootstrapped → /auth/login with username field
 *
 * Idempotent: safe to re-run against any of the above states.
 */

type BootstrapState = 'needs-login' | 'needs-configure' | 'bootstrapped';

// Module-level cache — detected once by the first test, reused by subsequent serial tests
let cachedState: BootstrapState | undefined;

async function detectBootstrapState(page: import('@playwright/test').Page): Promise<BootstrapState> {
  if (cachedState) {
    return cachedState;
  }

  const homePage = new HomePagePo(page);

  await homePage.goTo();

  // Wait for SPA redirect to settle — unauthenticated users land on /auth/login or /auth/setup
  await expect(page).toHaveURL(/\/auth\/(login|setup)/, { timeout: EXTENDED });

  const url = page.url();

  // CATTLE_BOOTSTRAP_PASSWORD set → Rancher skips login, goes straight to configure
  if (url.includes('/auth/setup')) {
    cachedState = 'needs-configure';

    return cachedState;
  }

  // Check for username field (only on real login page, not bootstrap page)
  const usernameField = page.getByTestId('local-login-username');

  try {
    await usernameField.waitFor({ state: 'visible', timeout: BRIEF });
    cachedState = 'bootstrapped';
  } catch {
    cachedState = 'needs-login';
  }

  return cachedState;
}

test.describe('Rancher setup', { tag: ['@setup', '@adminUserSetup', '@standardUserSetup'] }, () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ envMeta }) => {
    test.skip(!envMeta.bootstrapPassword, 'Requires CATTLE_BOOTSTRAP_PASSWORD');
  });

  test('Requires initial setup', async ({ page }) => {
    const state = await detectBootstrapState(page);

    test.skip(state !== 'needs-login', `Bootstrap state: ${state}`);

    await expect(page).not.toHaveURL(/\/home/, { timeout: STANDARD });

    const rancherSetupLoginPage = new RancherSetupLoginPagePo(page);

    await rancherSetupLoginPage.waitForPage();
    await expect(rancherSetupLoginPage.infoMessage()).toBeVisible();
  });

  test('Confirm correct number of settings requests made', async ({ page, envMeta }) => {
    const state = await detectBootstrapState(page);

    test.skip(state !== 'needs-login', `Bootstrap state: ${state}`);

    const settingsUrl = '**/v1/management.cattle.io.settings?exclude=metadata.managedFields';
    const rancherSetupLoginPage = new RancherSetupLoginPagePo(page);
    const rancherSetupConfigurePage = new RancherSetupConfigurePage(page);
    const settingsResponses: any[] = [];

    await page.route(settingsUrl, async (route) => {
      const response = await route.fetch();
      const body = await response.json();

      settingsResponses.push(body);
      await route.fulfill({ response });
    });

    await rancherSetupLoginPage.goTo();

    await page.waitForResponse((resp) => resp.url().includes('management.cattle.io.settings'));
    expect(settingsResponses[0].count).toBeLessThan(PARTIAL_SETTING_THRESHOLD);
    expect(settingsResponses).toHaveLength(1);

    await rancherSetupLoginPage.waitForPage();

    const settingsAfterLogin = page.waitForResponse((resp) => resp.url().includes('management.cattle.io.settings'));

    await rancherSetupLoginPage.bootstrapLogin(envMeta.bootstrapPassword!);

    await settingsAfterLogin;
    expect(settingsResponses[1].count).toBeGreaterThanOrEqual(PARTIAL_SETTING_THRESHOLD);

    await rancherSetupConfigurePage.waitForPage();

    // Grace period to catch any unexpected extra settings requests
    await page.waitForTimeout(1000);
    expect(settingsResponses).toHaveLength(2);

    // Test 2 consumed the bootstrap login — invalidate cached state for subsequent tests
    cachedState = undefined;
  });

  test('Login & Configure', async ({ page, envMeta }) => {
    const rancherSetupConfigurePage = new RancherSetupConfigurePage(page);
    const state = await detectBootstrapState(page);

    test.skip(state === 'bootstrapped', 'Rancher already bootstrapped');

    // Scenario 1: fresh Rancher needs bootstrap login first
    if (state === 'needs-login') {
      const rancherSetupLoginPage = new RancherSetupLoginPagePo(page);
      const loginPromise = page.waitForResponse('**/v1-public/login');

      await rancherSetupLoginPage.waitForPage();
      await rancherSetupLoginPage.bootstrapLogin(envMeta.bootstrapPassword!);

      const loginResp = await loginPromise;

      // eslint-disable-next-line playwright/no-conditional-expect -- only runs for 'needs-login' bootstrap scenario
      expect(loginResp.status()).toBe(200);
    }

    // Both scenarios land on /auth/setup — configure and submit
    await rancherSetupConfigurePage.waitForPage();
    expect(await rancherSetupConfigurePage.canSubmit()).toBe(false);

    // Scenario 2: CATTLE_BOOTSTRAP_PASSWORD flow skips login page, so the bootstrap password
    // field is shown on the configure page and must be filled before submit is enabled
    if (state === 'needs-configure') {
      const bootstrapInput = rancherSetupConfigurePage.bootstrapPasswordInput();

      await bootstrapInput.waitFor({ state: 'visible' });
      await bootstrapInput.fill(envMeta.bootstrapPassword!);
    }

    // Set admin password to TEST_PASSWORD by intercepting the password change API request.
    // Direct DOM fill doesn't work because Vue's :value binding overwrites it.
    await page.route('**/ext.cattle.io.passwordchangerequests', async (route) => {
      const request = route.request();

      if (request.method() === 'POST') {
        const body = JSON.parse(request.postData() || '{}');

        body.spec.newPassword = envMeta.password;
        await route.continue({ postData: JSON.stringify(body) });
      } else {
        await route.continue();
      }
    });

    // Also intercept legacy v3 password change endpoint
    await page.route('**/v3/users?action=changepassword', async (route) => {
      const request = route.request();

      if (request.method() === 'POST') {
        const body = JSON.parse(request.postData() || '{}');

        body.newPassword = envMeta.password;
        await route.continue({ postData: JSON.stringify(body) });
      } else {
        await route.continue();
      }
    });

    const serverUrlField = rancherSetupConfigurePage.serverUrl();

    await expect(serverUrlField.self()).toBeVisible();

    // Docker hostnames like "https://rancher-2" fail Rancher's URL validator (requires dots in host).
    // Fix by appending ".svc" to make it a synthetic FQDN.
    const currentServerUrl = await serverUrlField.value();
    const hostPart = currentServerUrl.replace(/^https?:\/\//, '').replace(/[:/].*$/, '');

    if (hostPart && !hostPart.includes('.')) {
      await serverUrlField.set(currentServerUrl.replace(hostPart, `${hostPart}.svc`));
    }

    await rancherSetupConfigurePage.termsAgreement().set();
    expect(await rancherSetupConfigurePage.canSubmit()).toBe(true);
    await rancherSetupConfigurePage.submit();

    const prefsPromise = page.waitForResponse('**/v1/userpreferences/*');

    await expect(page).toHaveURL(/\/home/, SHORT_TIMEOUT_OPT);

    const prefsResp = await prefsPromise;

    expect(prefsResp.status()).toBe(200);
  });

  test('Create standard user', async ({ rancherApi, envMeta }) => {
    await rancherApi.login(envMeta.username, envMeta.password);

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
