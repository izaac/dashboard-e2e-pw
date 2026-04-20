import { test, expect } from '@/support/fixtures';
import { RancherSetupLoginPagePo } from '@/e2e/po/pages/rancher-setup-login.po';
import { RancherSetupConfigurePage } from '@/e2e/po/pages/rancher-setup-configure.po';
import HomePagePo from '@/e2e/po/pages/home.po';
import { PARTIAL_SETTING_THRESHOLD } from '@/support/utils/settings-utils';

/**
 * Rancher setup — equivalent of cypress/e2e/tests/setup/rancher-setup.spec.ts
 *
 * Tags mirror the Cypress grep tags for filtering:
 * @adminUserSetup @standardUserSetup @setup
 */
test.describe('Rancher setup', { tag: ['@setup', '@adminUserSetup', '@standardUserSetup'] }, () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ envMeta }) => {
    test.skip(!envMeta.bootstrapPassword, 'Requires CATTLE_BOOTSTRAP_PASSWORD and a fresh Rancher instance');
  });

  test('Requires initial setup', async ({ page }) => {
    const homePage = new HomePagePo(page);
    const rancherSetupLoginPage = new RancherSetupLoginPagePo(page);

    await homePage.goTo();
    await rancherSetupLoginPage.goTo();
    await rancherSetupLoginPage.waitForPage();
    await rancherSetupLoginPage.hasInfoMessage();
  });

  test('Confirm correct number of settings requests made', async ({ page, envMeta }) => {
    const settingsUrl = '**/v1/management.cattle.io.settings?exclude=metadata.managedFields';
    const rancherSetupLoginPage = new RancherSetupLoginPagePo(page);
    const rancherSetupConfigurePage = new RancherSetupConfigurePage(page);

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

    // Intercept bootstrap login
    const loginPromise = page.waitForResponse('**/v1-public/login');

    await rancherSetupLoginPage.goTo();
    await rancherSetupLoginPage.waitForPage();
    await rancherSetupLoginPage.bootstrapLogin(envMeta.bootstrapPassword!);

    const loginResp = await loginPromise;

    expect(loginResp.status()).toBe(200);

    await rancherSetupConfigurePage.waitForPage();
    expect(await rancherSetupConfigurePage.canSubmit()).toBe(false);

    // Check server URL is visible
    await rancherSetupConfigurePage.serverUrl().checkVisible();

    // Rancher head skips the password section when CATTLE_BOOTSTRAP_PASSWORD is set.
    // Password stays as the bootstrap value — no interaction needed.

    // Accept terms and submit (use PO .set() which clicks .checkbox-custom, not the label)
    await rancherSetupConfigurePage.termsAgreement().set();
    expect(await rancherSetupConfigurePage.canSubmit()).toBe(true);
    await rancherSetupConfigurePage.submit();

    // Wait for first login preferences
    const prefsPromise = page.waitForResponse('**/v1/userpreferences/*');

    await expect(page).toHaveURL(/\/home/, { timeout: 15000 });

    const prefsResp = await prefsPromise;

    expect(prefsResp.status()).toBe(200);
  });

  test('Create standard user', async ({ rancherApi, envMeta }) => {
    // Re-login — the worker-scoped rancherApi token was obtained before bootstrap and is now invalid
    await rancherApi.login(envMeta.username, envMeta.password);

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
