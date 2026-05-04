import { test, expect } from '@/support/fixtures';
import { RancherSetupLoginPagePo } from '@/e2e/po/pages/rancher-setup-login.po';
import { RancherSetupConfigurePage } from '@/e2e/po/pages/rancher-setup-configure.po';
import { LoginPagePo } from '@/e2e/po/pages/login-page.po';
import HomePagePo from '@/e2e/po/pages/home.po';
import { PARTIAL_SETTING_THRESHOLD } from '@/support/utils/settings-utils';
import { SHORT_TIMEOUT_OPT, MEDIUM_TIMEOUT_OPT } from '@/support/timeouts';
import { BRIEF, EXTENDED, STANDARD } from '@/support/timeouts';

/**
 * Rancher setup — equivalent of cypress/e2e/tests/setup/rancher-setup.spec.ts
 *
 * Handles four bootstrap scenarios:
 *   1. Fresh Rancher (no CATTLE_BOOTSTRAP_PASSWORD) → /auth/login bootstrap page
 *   2. CATTLE_BOOTSTRAP_PASSWORD set, not yet configured → /auth/setup directly
 *   3. Already bootstrapped, admin exists → /auth/login with username field
 *   4. Fully configured (admin + standard_user) → skip everything
 *
 * Idempotent: safe to re-run against any of the above states.
 * Critical path (Login & Configure, Create standard user) runs first so
 * upstream parity checks never block the rest of the suite.
 */

type BootstrapState = 'needs-login' | 'needs-configure' | 'bootstrapped';

/**
 * Detect the current Rancher bootstrap state by navigating to the home page
 * and checking where the SPA redirects. Always performs a fresh check — each
 * test gets its own page, so server state may have changed between tests.
 */
async function detectBootstrapState(page: import('@playwright/test').Page): Promise<BootstrapState> {
  const homePage = new HomePagePo(page);

  await homePage.goTo();

  // Wait for SPA redirect to settle — unauthenticated users land on /auth/login or /auth/setup
  await expect(page).toHaveURL(/\/auth\/(login|setup)/, { timeout: EXTENDED });

  const url = page.url();

  // CATTLE_BOOTSTRAP_PASSWORD set → Rancher skips login, goes straight to configure
  if (url.includes('/auth/setup')) {
    return 'needs-configure';
  }

  // Check for username field (only on real login page, not bootstrap page)
  const loginPage = new LoginPagePo(page);

  try {
    await loginPage.username().self().waitFor({ state: 'visible', timeout: BRIEF });

    return 'bootstrapped';
  } catch {
    return 'needs-login';
  }
}

test.describe('Rancher setup', { tag: ['@setup', '@adminUserSetup', '@standardUserSetup'] }, () => {
  // Serial: bootstrap flow has a hard ordering — login/EULA/password change must complete before standard-user provisioning.
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ envMeta }) => {
    test.skip(!envMeta.bootstrapPassword, 'Requires CATTLE_BOOTSTRAP_PASSWORD');
  });

  // ── Critical path — must succeed for the rest of the suite to run ─────────

  test('Login & Configure', async ({ page, envMeta }) => {
    const rancherSetupConfigurePage = new RancherSetupConfigurePage(page);
    const state = await detectBootstrapState(page);

    test.skip(state === 'bootstrapped', 'Rancher already bootstrapped');

    // Scenario 1: fresh Rancher needs bootstrap login first
    if (state === 'needs-login') {
      const rancherSetupLoginPage = new RancherSetupLoginPagePo(page);

      await rancherSetupLoginPage.waitForPage();
      await rancherSetupLoginPage.bootstrapLogin(envMeta.bootstrapPassword!);

      // After login, SPA redirects to /auth/setup — API-agnostic (works with v1-public and v2.15+)
      // eslint-disable-next-line playwright/no-conditional-expect -- redirect only occurs in needs-login state; expect is correct branch guard
      await expect(page).toHaveURL(/\/auth\/setup/, MEDIUM_TIMEOUT_OPT);
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

    const prefsPromise = page.waitForResponse('**/v1/userpreferences/*', MEDIUM_TIMEOUT_OPT);

    await expect(page).toHaveURL(/\/home/, SHORT_TIMEOUT_OPT);

    const prefsResp = await prefsPromise;

    expect(prefsResp.status()).toBe(200);
  });

  test('Create standard user', async ({ rancherApi, envMeta }) => {
    await rancherApi.login(envMeta.username, envMeta.password);

    // Disable telemetry (anonymous statistics) explicitly
    const telemetrySettings = await rancherApi.getRancherResource(
      'v1',
      'management.cattle.io.settings',
      'telemetry-opt',
      0,
    );

    if (telemetrySettings.status === 404) {
      await rancherApi.createRancherResource(
        'v1',
        'management.cattle.io.settings',
        {
          metadata: { name: 'telemetry-opt' },
          value: 'out',
          default: 'prompt',
        },
        false,
      );
    } else if (telemetrySettings.body?.value !== 'out') {
      await rancherApi.setRancherResource(
        'v1',
        'management.cattle.io.settings',
        'telemetry-opt',
        {
          ...telemetrySettings.body,
          value: 'out',
        },
        false,
      );
    }

    const usersResp = await rancherApi.getRancherResource('v1', 'management.cattle.io.users');
    const existingUser = usersResp.body.data.find((u: { username?: string }) => u.username?.includes('standard_user'));

    if (existingUser) {
      test.skip(true, 'Standard user already exists');
    }

    const createResp = await rancherApi.createUser(
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

    expect(createResp.body?.id).toBeTruthy();
  });

  // ── Upstream parity checks — run after critical path, skip when already bootstrapped ──

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

    await page.waitForResponse((resp) => resp.url().includes('management.cattle.io.settings'), MEDIUM_TIMEOUT_OPT);
    expect(settingsResponses[0].count).toBeLessThan(PARTIAL_SETTING_THRESHOLD);
    expect(settingsResponses).toHaveLength(1);

    await rancherSetupLoginPage.waitForPage();

    const settingsAfterLogin = page.waitForResponse(
      (resp) => resp.url().includes('management.cattle.io.settings'),
      MEDIUM_TIMEOUT_OPT,
    );

    await rancherSetupLoginPage.bootstrapLogin(envMeta.bootstrapPassword!);

    await settingsAfterLogin;
    expect(settingsResponses[1].count).toBeGreaterThanOrEqual(PARTIAL_SETTING_THRESHOLD);

    await rancherSetupConfigurePage.waitForPage();

    // networkidle gives a deterministic settle point after the configure page
    // mounts — any late settings request lands before this resolves and is
    // counted, replacing the previous fixed 1 s grace period.
    // eslint-disable-next-line playwright/no-networkidle -- intentional: we are explicitly counting all settings requests, so we need to wait for network quiescence rather than a single response
    await page.waitForLoadState('networkidle');
    expect(settingsResponses).toHaveLength(2);
  });
});
