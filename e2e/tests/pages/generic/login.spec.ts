import { test, expect } from '@/support/fixtures';
import { LoginPagePo } from '@/e2e/po/pages/login-page.po';
import { PARTIAL_SETTING_THRESHOLD } from '@/support/utils/settings-utils';
import { SHORT_TIMEOUT_OPT } from '@/support/timeouts';

test.describe('Local authentication', { tag: ['@generic', '@adminUser', '@standardUser'] }, () => {
  // Login tests must start unauthenticated — clear storageState
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Confirm correct number of settings requests made', async ({ page, envMeta }) => {
    const loginPage = new LoginPagePo(page);
    const settingsMatch = (resp: { url: () => string }) =>
      resp.url().includes('management.cattle.io.settings?exclude=metadata.managedFields');

    // Start listening BEFORE navigation
    const firstSettingsPromise = page.waitForResponse(settingsMatch);

    await loginPage.goTo();

    // First request — partial settings (unauthed)
    const firstResp = await firstSettingsPromise;
    const firstBody = await firstResp.json();

    expect(firstBody.count).toBeLessThan(PARTIAL_SETTING_THRESHOLD);

    await loginPage.waitForPage();
    await loginPage.switchToLocal();
    await loginPage.username().set(envMeta.username);
    await loginPage.password().set(envMeta.password);

    // Start listening BEFORE submit
    const secondSettingsPromise = page.waitForResponse(settingsMatch);

    await loginPage.submit();

    await expect(page).not.toHaveURL(/\/auth\/login/, SHORT_TIMEOUT_OPT);

    // Second request — full settings (authed)
    const secondResp = await secondSettingsPromise;
    const secondBody = await secondResp.json();

    expect(secondBody.count).toBeGreaterThan(PARTIAL_SETTING_THRESHOLD);
  });

  test('Log in with valid credentials', async ({ page, envMeta }) => {
    const loginPage = new LoginPagePo(page);

    await loginPage.goTo();
    await loginPage.switchToLocal();
    await loginPage.username().set(envMeta.username);
    await loginPage.password().set(envMeta.password);

    // Start waiting BEFORE the action that triggers the response
    const loginPromise = page.waitForResponse('**/v1-public/login*');

    await loginPage.submit();

    const loginResp = await loginPromise;

    expect(loginResp.status()).toBe(200);
    await expect(page).not.toHaveURL(/\/auth\/login/);
  });

  test('Cannot login with invalid credentials', async ({ page, envMeta }) => {
    const loginPage = new LoginPagePo(page);

    await loginPage.goTo();
    await loginPage.switchToLocal();
    await loginPage.username().set(envMeta.username);
    await loginPage.password().set(`${envMeta.password}abc`);

    // Start waiting BEFORE the action that triggers the response
    const loginPromise = page.waitForResponse('**/v1-public/login*');

    await loginPage.submit();

    const loginResp = await loginPromise;

    expect(loginResp.status()).toBe(401);

    // URL should still contain /auth/login after failed login
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
