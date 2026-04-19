import { test, expect } from '@/support/fixtures';
import UsersPo from '@/e2e/po/pages/users-and-auth/users.po';
import UserRetentionPo from '@/e2e/po/pages/users-and-auth/user.retention.po';

test.describe('Auth Index', { tag: ['@usersAndAuths', '@adminUser'] }, () => {
  test('can redirect', async ({ page, login }) => {
    await login();

    await page.goto('./c/local/auth', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/c\/local\/auth\/management\.cattle\.io\.user/);
  });
});

test.describe('User Retention', { tag: ['@usersAndAuths', '@adminUser'] }, () => {
  const SETTINGS = {
    disable: 'disable-inactive-user-after',
    delete: 'delete-inactive-user-after',
    cron: 'user-retention-cron',
    login: 'user-last-login-default',
  } as const;

  test('can navigate to user retention settings', async ({ page, login }) => {
    await login();
    const usersPo = new UsersPo(page, 'local');

    await usersPo.goTo();
    await usersPo.waitForPage();
    await usersPo.userRetentionLink().click();

    await expect(page).toHaveURL(/\/auth\/user\.retention/);
  });

  test('save button should be disabled when form is invalid', async ({ page, login }) => {
    await login();
    const userRetention = new UserRetentionPo(page, 'local');

    await userRetention.goTo();
    await userRetention.waitForPage();
    await userRetention.disableAfterPeriodCheckbox().set();
    await userRetention.disableAfterPeriodInput().set('30d');

    await userRetention.saveButton().expectToBeDisabled();
  });

  test('save button should be enabled when form is valid', async ({ page, login }) => {
    await login();
    const userRetention = new UserRetentionPo(page, 'local');

    await userRetention.goTo();
    await userRetention.waitForPage();
    await userRetention.disableAfterPeriodCheckbox().set();
    await userRetention.disableAfterPeriodInput().set('300h');
    await userRetention.userRetentionCron().set('0 0 1 1 *');

    await userRetention.saveButton().expectToBeEnabled();
  });

  test('can save user retention settings', async ({ page, login, rancherApi }) => {
    await login();

    const origDisable = await rancherApi.getRancherResource('v3', 'settings', SETTINGS.disable);
    const origDelete = await rancherApi.getRancherResource('v3', 'settings', SETTINGS.delete);
    const origCron = await rancherApi.getRancherResource('v3', 'settings', SETTINGS.cron);
    const origLogin = await rancherApi.getRancherResource('v3', 'settings', SETTINGS.login);

    const userRetention = new UserRetentionPo(page, 'local');

    await userRetention.goTo();
    await userRetention.waitForPage();

    try {
      await userRetention.disableAfterPeriodCheckbox().set();
      await userRetention.disableAfterPeriodInput().set('300h');
      await userRetention.deleteAfterPeriodCheckbox().set();
      await userRetention.deleteAfterPeriodInput().set('600h');
      await userRetention.userRetentionCron().set('0 0 1 1 *');
      await userRetention.userLastLoginDefault().set('1718744536000');

      await userRetention.saveButton().click();

      // Wait for save redirect to complete before navigating back
      await page.waitForURL(/\/(management\.cattle\.io\.user|home)/, { timeout: 15000 });

      await userRetention.goTo();
      await userRetention.waitForPage();

      expect(await userRetention.disableAfterPeriodInput().value()).toBe('300h');
      expect(await userRetention.deleteAfterPeriodInput().value()).toBe('600h');
      expect(await userRetention.userRetentionCron().value()).toBe('0 0 1 1 *');
      expect(await userRetention.userLastLoginDefault().value()).toBe('1718744536000');
    } finally {
      await rancherApi
        .setRancherResource('v3', 'settings', SETTINGS.disable, { value: origDisable.body.value || '' })
        .catch(() => {});
      await rancherApi
        .setRancherResource('v3', 'settings', SETTINGS.delete, { value: origDelete.body.value || '' })
        .catch(() => {});
      await rancherApi
        .setRancherResource('v3', 'settings', SETTINGS.cron, { value: origCron.body.value || '' })
        .catch(() => {});
      await rancherApi
        .setRancherResource('v3', 'settings', SETTINGS.login, { value: origLogin.body.value || '' })
        .catch(() => {});
    }
  });

  test('verify user account has countdown timers', async ({ page, login, rancherApi: _rancherApi }) => {
    test.skip(true, 'Requires user creation + login cycling — complex setup not yet implemented');

    await login();
    const usersPo = new UsersPo(page, 'local');

    await usersPo.goTo();
    await usersPo.waitForPage();
  });

  test('standard user should not have access to user retention page', async ({ page, login }) => {
    test.skip(true, 'Requires standard user credentials not available in current env');

    await login();
    const usersPo = new UsersPo(page, 'local');

    await usersPo.goTo();
    await usersPo.waitForPage();

    await expect(usersPo.userRetentionLink()).toBeHidden();
  });

  test('standard user should not access user retention page directly', async ({ page, login }) => {
    test.skip(true, 'Requires standard user credentials not available in current env');

    await login();
    const userRetention = new UserRetentionPo(page, 'local');

    await userRetention.goTo();

    await expect(page).not.toHaveURL(/\/auth\/user\.retention/);
  });
});
