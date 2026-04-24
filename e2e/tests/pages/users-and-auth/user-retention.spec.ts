import { test, expect } from '@/support/fixtures';
import UsersPo from '@/e2e/po/pages/users-and-auth/users.po';
import UserRetentionPo from '@/e2e/po/pages/users-and-auth/user.retention.po';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import { EXTENDED } from '@/support/timeouts';

async function updateUserRetentionSetting(
  rancherApi: RancherApi,
  settingId: string,
  newValue: string | null,
): Promise<void> {
  const result = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings');
  const retentionSetting = result.body.data.find((s: any) => s.id === settingId);

  if (!retentionSetting) {
    return;
  }

  retentionSetting.value = newValue;
  await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', settingId, retentionSetting);
}

async function resetRetentionSettings(rancherApi: RancherApi): Promise<void> {
  await updateUserRetentionSetting(rancherApi, 'disable-inactive-user-after', null);
  await updateUserRetentionSetting(rancherApi, 'user-retention-cron', null);
  await updateUserRetentionSetting(rancherApi, 'delete-inactive-user-after', null);
  await updateUserRetentionSetting(rancherApi, 'user-last-login-default', null);
}

test.describe('User retention: admin user', { tag: ['@usersAndAuths', '@adminUser'] }, () => {
  // All tests mutate the same global retention settings - serial prevents conflicts
  test.describe.configure({ mode: 'serial' });
  test('save button should be disabled when form is invalid', async ({ page, login, rancherApi }) => {
    try {
      await login();

      const userRetentionPo = new UserRetentionPo(page);

      await userRetentionPo.goTo();
      await userRetentionPo.waitForPage();
      await userRetentionPo.disableAfterPeriodCheckbox().set();
      await userRetentionPo.disableAfterPeriodInput().set('30d');

      await expect(userRetentionPo.saveButton().self()).toBeDisabled();
    } finally {
      await resetRetentionSettings(rancherApi);
    }
  });

  test('save button should be enabled when form is valid', async ({ page, login, rancherApi }) => {
    try {
      await login();

      const userRetentionPo = new UserRetentionPo(page);

      await userRetentionPo.goTo();
      await userRetentionPo.waitForPage();
      await userRetentionPo.disableAfterPeriodCheckbox().set();
      await userRetentionPo.disableAfterPeriodInput().set('300h');
      await userRetentionPo.userRetentionCron().set('0 0 1 1 *');

      await expect(userRetentionPo.saveButton().self()).toBeEnabled();
    } finally {
      await resetRetentionSettings(rancherApi);
    }
  });

  test('can save user retention settings', async ({ page, login, rancherApi }) => {
    // Reset to defaults before starting
    await resetRetentionSettings(rancherApi);

    try {
      await login();

      const userRetentionPo = new UserRetentionPo(page);

      await userRetentionPo.goTo();
      await userRetentionPo.waitForPage();

      // Ensure checkboxes are unchecked before starting
      await userRetentionPo.disableAfterPeriodCheckbox().uncheck();
      await userRetentionPo.deleteAfterPeriodCheckbox().uncheck();

      await expect(userRetentionPo.disableAfterPeriodInput().self()).toBeDisabled();
      await userRetentionPo.disableAfterPeriodCheckbox().set();
      await expect(userRetentionPo.disableAfterPeriodInput().self()).toBeEnabled();
      await userRetentionPo.disableAfterPeriodInput().set('300h');
      await expect(userRetentionPo.deleteAfterPeriodInput().self()).toBeDisabled();
      await userRetentionPo.deleteAfterPeriodCheckbox().set();
      await expect(userRetentionPo.deleteAfterPeriodInput().self()).toBeEnabled();
      await userRetentionPo.deleteAfterPeriodInput().set('600h');
      await userRetentionPo.userRetentionCron().set('0 0 1 1 *');
      await userRetentionPo.userLastLoginDefault().set('1718744536000');

      await expect(userRetentionPo.saveButton().self()).toBeEnabled();

      // The save fires multiple PUTs — collect them all before asserting
      let resolveAll: () => void;
      const allDone = new Promise<void>((r) => {
        resolveAll = r;
      });
      let count = 0;

      page.on('response', (resp) => {
        if (resp.url().includes('/v1/management.cattle.io.settings/') && resp.request().method() === 'PUT') {
          count++;

          if (count >= 5) {
            resolveAll();
          }
        }
      });

      await userRetentionPo.saveButton().click();

      await Promise.race([allDone, new Promise((r) => setTimeout(r, 30000))]);

      const usersPo = new UsersPo(page);

      // Wait for any in-progress SPA navigation to settle
      // The save may trigger a route change; retry goto if ERR_ABORTED
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await page.goto('./c/_/auth/management.cattle.io.user', { waitUntil: 'domcontentloaded', timeout: EXTENDED });
          break;
        } catch {
          await page.waitForLoadState('domcontentloaded').catch(() => {
            /* page may have already navigated */
          });
        }
      }

      await usersPo.waitForPage();

      await expect(usersPo.userRetentionLink()).toBeVisible();
      await usersPo.userRetentionLink().click();

      await expect(userRetentionPo.disableAfterPeriodCheckbox().self()).toBeAttached();
      await expect(userRetentionPo.disableAfterPeriodCheckbox().checkboxCustom()).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await expect(userRetentionPo.disableAfterPeriodInput().self()).toHaveValue('300h');
      await expect(userRetentionPo.deleteAfterPeriodCheckbox().checkboxCustom()).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await expect(userRetentionPo.deleteAfterPeriodInput().self()).toHaveValue('600h');
      await expect(userRetentionPo.userRetentionCron().self()).toHaveValue('0 0 1 1 *');
      await expect(userRetentionPo.userLastLoginDefault().self()).toHaveValue('1718744536000');
    } finally {
      await resetRetentionSettings(rancherApi);
    }
  });

  test('setup a user account that will be blocked', async ({ page, login, rancherApi, envMeta }) => {
    const runTimestamp = Date.now();
    const usernameBlock = `user_to_block_${runTimestamp}`;
    const userPassword = envMeta.password;
    const userIds: string[] = [];

    try {
      await updateUserRetentionSetting(rancherApi, 'disable-inactive-user-after', '50h');
      await updateUserRetentionSetting(rancherApi, 'user-retention-cron', '* * * * *');
      await updateUserRetentionSetting(rancherApi, 'delete-inactive-user-after', '500h');

      const userResp = await rancherApi.createUser(
        {
          username: usernameBlock,
          globalRole: { role: 'user' },
          projectRole: {
            clusterId: 'local',
            projectName: 'Default',
            role: 'project-member',
          },
          password: userPassword,
        },
        { createNameOptions: { onlyContext: true } },
      );

      userIds.push(userResp.body.id);

      // Login as the test user to activate retention tracking
      await login({ username: usernameBlock, password: userPassword });

      // Re-login as admin
      await login();
    } finally {
      // Cleanup: reset settings and delete users
      await resetRetentionSettings(rancherApi);

      for (const userId of userIds) {
        await rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', userId, false);
      }
    }
  });

  test('verify the user account has countdown timers', async ({ page, login, rancherApi, envMeta }) => {
    const runTimestamp = Date.now();
    const usernameBlock = `user_to_block_${runTimestamp}`;
    const userPassword = envMeta.password;
    const userIds: string[] = [];

    try {
      await updateUserRetentionSetting(rancherApi, 'disable-inactive-user-after', '50h');
      await updateUserRetentionSetting(rancherApi, 'user-retention-cron', '* * * * *');
      await updateUserRetentionSetting(rancherApi, 'delete-inactive-user-after', '500h');

      const userResp = await rancherApi.createUser(
        {
          username: usernameBlock,
          globalRole: { role: 'user' },
          projectRole: {
            clusterId: 'local',
            projectName: 'Default',
            role: 'project-member',
          },
          password: userPassword,
        },
        { createNameOptions: { onlyContext: true } },
      );

      userIds.push(userResp.body.id);

      // Login as the test user to activate retention tracking
      await login({ username: usernameBlock, password: userPassword });

      // Re-login as admin
      await login();

      const usersPo = new UsersPo(page);

      await usersPo.goTo();
      await usersPo.waitForPage();

      // Column 7 = Disable After, column 8 = Delete After
      const disableAfterCol = usersPo
        .list()
        .resourceTable()
        .sortableTable()
        .rowWithPartialName(usernameBlock)
        .column(7);

      await expect(disableAfterCol).not.toHaveText('-');

      const deleteAfterCol = usersPo.list().resourceTable().sortableTable().rowWithPartialName(usernameBlock).column(8);

      await expect(deleteAfterCol).not.toHaveText('-');
    } finally {
      // Cleanup: reset settings and delete users
      await resetRetentionSettings(rancherApi);

      for (const userId of userIds) {
        await rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', userId, false);
      }
    }
  });

  test('standard user should not have access to user retention page', async ({ page, login, rancherApi }) => {
    const runTimestamp = Date.now();
    const stdUsername = `std_user_retention_${runTimestamp}`;
    let userId = '';

    try {
      const password = 'test-password-12345';
      const userResp = await rancherApi.createUser(
        {
          username: stdUsername,
          globalRole: { role: 'user' },
          password,
        },
        { createNameOptions: { onlyContext: true } },
      );

      userId = userResp.body.id;

      // Login as the standard user
      await login({ username: stdUsername, password });

      const usersPo = new UsersPo(page);

      await usersPo.goTo();
      await usersPo.waitForPage();

      // Standard user should not see the user retention link
      await expect(usersPo.userRetentionLink()).not.toBeAttached();
    } finally {
      if (userId) {
        await rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', userId, false);
      }
    }
  });
});
