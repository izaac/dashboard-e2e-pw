import type { Page } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import UsersPo from '@/e2e/po/pages/users-and-auth/users.po';
import { BRIEF, SHORT_TIMEOUT_OPT } from '@/support/timeouts';

const ESCALATION_ERROR_TEXT =
  'You cannot assign Global Permissions that are higher than your own. Please verify the permissions you are attempting to assign.';
const ORPHAN_WARNING_PREFIX = 'The user "';
const ORPHAN_WARNING_SUFFIX =
  '" was created, but its roles could not be assigned and the incomplete account could not be removed automatically. Open the users list to review or delete it.';
const EXPECTED_ZERO_COUNT = 0;
const EXPECTED_SINGLE_BANNER_COUNT = 1;
const EXPECTED_TWO_BANNERS_COUNT = 2;
const ADMIN_ROLE_LABEL = 'Administrator';
const MANAGER_PASSWORD = 'password1234';
const TEST_USER_PASSWORD = 'password1234';
const SIMULATED_FAILURE_STATUS = 500;

async function deleteUserByUsername(api: RancherApi, username: string): Promise<void> {
  try {
    const resp = await api.getRancherResource('v3', `users?username=${username}`, undefined, 0);
    const user = resp.body?.data?.[0];

    if (user) {
      await api.deleteRancherResource('v3', 'users', user.id, false);
    }
  } catch (err) {
    console.warn(`[users cleanup] deleteUserByUsername(${username}) failed: ${(err as Error)?.message ?? err}`);
  }
}

async function dismissWelcomeModal(page: Page): Promise<void> {
  const closeBtn = page.getByTestId('release-welcome-close');

  try {
    await closeBtn.waitFor({ state: 'visible', timeout: BRIEF });
    await closeBtn.click();
    await closeBtn.waitFor({ state: 'detached', timeout: BRIEF });
  } catch {
    // Welcome modal did not appear or was already dismissed
  }
}

test.describe('User Creation Role Assignment Failure Feedback', { tag: ['@adminUser', '@usersAndAuths'] }, () => {
  const runPrefix = `qa-15293-${Date.now()}`;
  const managerUsername = `${runPrefix}-mgr`;
  let managerUserId = '';

  test.beforeAll(async ({ rancherApi }) => {
    // Provision non-admin manager user with 'users-manage' and 'user' global roles
    const userResp = await rancherApi.createRancherResource('v1', 'management.cattle.io.users', {
      type: 'user',
      enabled: true,
      mustChangePassword: false,
      username: managerUsername,
    });

    expect(userResp.status).toBe(201);
    managerUserId = userResp.body.id;

    await rancherApi.createUserPasswordAsSecret(managerUserId, MANAGER_PASSWORD);
    await rancherApi.setGlobalRoleBinding(managerUserId, 'user');
    await rancherApi.setGlobalRoleBinding(managerUserId, 'users-manage');
  });

  test.afterAll(async ({ rancherApi }) => {
    if (managerUserId) {
      await rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', managerUserId, false);
    }
  });

  test('should show escalation error and automatically roll back user when non-admin assigns administrator role', async ({
    page,
    login,
  }) => {
    const targetUsername = `${runPrefix}-esc-clean`;

    await login({ username: managerUsername, password: MANAGER_PASSWORD });

    const usersPo = new UsersPo(page);
    const userCreate = usersPo.createEdit();

    await userCreate.goTo();
    await userCreate.waitForPage();
    await dismissWelcomeModal(page);

    await userCreate.username().set(targetUsername);
    await userCreate.newPass().set(TEST_USER_PASSWORD);
    await userCreate.confirmNewPass().set(TEST_USER_PASSWORD);
    await userCreate.selectCheckbox(ADMIN_ROLE_LABEL).set();

    const grbEscalationResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('v3/globalrolebindings') && resp.request().method() === 'POST' && resp.status() === 403,
      SHORT_TIMEOUT_OPT,
    );

    await userCreate.resourceDetail().cruResource().saveOrCreate().click();
    await grbEscalationResponse;

    // Verify single escalation error banner is visible and orphan notice is absent
    await expect(userCreate.errorBanner()).toBeVisible();
    await expect(userCreate.errorBanners()).toHaveCount(EXPECTED_SINGLE_BANNER_COUNT);
    await expect(userCreate.errorBanner()).toContainText(ESCALATION_ERROR_TEXT);
    await expect(userCreate.errorBanner()).not.toContainText(ORPHAN_WARNING_PREFIX);

    // Verify rolled-back user does NOT persist in the Users list
    await usersPo.goTo();
    await usersPo.waitForPage();
    await expect(usersPo.list().elementWithName(targetUsername)).toHaveCount(EXPECTED_ZERO_COUNT);
  });

  test('should show orphan warning banner naming user alongside escalation error when rollback cleanup fails', async ({
    page,
    login,
    rancherApi,
  }) => {
    const targetUsername = `${runPrefix}-esc-orphan`;
    const expectedOrphanText = `${ORPHAN_WARNING_PREFIX}${targetUsername}${ORPHAN_WARNING_SUFFIX}`;

    await login({ username: managerUsername, password: MANAGER_PASSWORD });

    const usersPo = new UsersPo(page);
    const userCreate = usersPo.createEdit();

    await userCreate.goTo();
    await userCreate.waitForPage();
    await dismissWelcomeModal(page);

    // Intercept user deletion to simulate cleanup failure
    await page.route('**/v1/management.cattle.io.users/**', (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({
          status: SIMULATED_FAILURE_STATUS,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Simulated user cleanup failure' }),
        });
      }

      return route.continue();
    });

    try {
      await userCreate.username().set(targetUsername);
      await userCreate.newPass().set(TEST_USER_PASSWORD);
      await userCreate.confirmNewPass().set(TEST_USER_PASSWORD);
      await userCreate.selectCheckbox(ADMIN_ROLE_LABEL).set();

      const grbEscalationResponse = page.waitForResponse(
        (resp) =>
          resp.url().includes('v3/globalrolebindings') && resp.request().method() === 'POST' && resp.status() === 403,
        SHORT_TIMEOUT_OPT,
      );

      await userCreate.resourceDetail().cruResource().saveOrCreate().click();
      await grbEscalationResponse;

      // Verify BOTH banners appear: the escalation reason AND the orphan account warning
      await expect(userCreate.errorBanner()).toBeVisible();
      await expect(userCreate.errorBanners()).toHaveCount(EXPECTED_TWO_BANNERS_COUNT);
      await expect(userCreate.errorBanner()).toContainText(ESCALATION_ERROR_TEXT);
      await expect(userCreate.errorBanner()).toContainText(expectedOrphanText);
    } finally {
      await page.unroute('**/v1/management.cattle.io.users/**');
    }

    // Verify orphaned user is visible in users list
    await usersPo.goTo();
    await usersPo.waitForPage();
    await expect(usersPo.list().elementWithName(targetUsername)).toBeVisible();

    // Cleanup: remove orphaned user via API
    await deleteUserByUsername(rancherApi, targetUsername);
  });

  test('should successfully create user when non-admin assigns authorized role', async ({
    page,
    login,
    rancherApi,
  }) => {
    const targetUsername = `${runPrefix}-std-ok`;

    await login({ username: managerUsername, password: MANAGER_PASSWORD });

    const usersPo = new UsersPo(page);
    const userCreate = usersPo.createEdit();

    await userCreate.goTo();
    await userCreate.waitForPage();
    await dismissWelcomeModal(page);

    await userCreate.username().set(targetUsername);
    await userCreate.newPass().set(TEST_USER_PASSWORD);
    await userCreate.confirmNewPass().set(TEST_USER_PASSWORD);

    // Save with default Standard User role
    await userCreate.saveAndWaitForRequests('POST', '/v3/globalrolebindings');

    // Expect successful navigation to users list without error banners
    await usersPo.waitForPage();
    await expect(usersPo.list().elementWithName(targetUsername)).toBeVisible();

    // Cleanup: remove created user via API
    await deleteUserByUsername(rancherApi, targetUsername);
  });

  test('should allow in-place permission correction and successful recreation without duplicate name conflict after escalation rollback', async ({
    page,
    login,
    rancherApi,
  }) => {
    const targetUsername = `${runPrefix}-esc-retry`;

    await login({ username: managerUsername, password: MANAGER_PASSWORD });

    const usersPo = new UsersPo(page);
    const userCreate = usersPo.createEdit();

    await userCreate.goTo();
    await userCreate.waitForPage();
    await dismissWelcomeModal(page);

    await userCreate.username().set(targetUsername);
    await userCreate.newPass().set(TEST_USER_PASSWORD);
    await userCreate.confirmNewPass().set(TEST_USER_PASSWORD);
    await userCreate.selectCheckbox(ADMIN_ROLE_LABEL).set();

    // First attempt: trigger escalation failure
    const grbEscalationResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('v3/globalrolebindings') && resp.request().method() === 'POST' && resp.status() === 403,
      SHORT_TIMEOUT_OPT,
    );

    await userCreate.resourceDetail().cruResource().saveOrCreate().click();
    await grbEscalationResponse;

    await expect(userCreate.errorBanner()).toBeVisible();
    await expect(userCreate.errorBanner()).toContainText(ESCALATION_ERROR_TEXT);

    // Dismiss the error banner
    await userCreate.errorBannerCloseButton().click();
    await expect(userCreate.errorBanner()).not.toBeAttached();

    // In-place correction: uncheck Administrator to leave authorized roles
    await userCreate.selectCheckbox(ADMIN_ROLE_LABEL).uncheck();

    // Second attempt: save should succeed without 409 conflict because initial account was cleanly deleted
    await userCreate.saveAndWaitForRequests('POST', '/v3/globalrolebindings');

    await usersPo.waitForPage();
    await expect(usersPo.list().elementWithName(targetUsername)).toBeVisible();

    // Cleanup: remove created user via API
    await deleteUserByUsername(rancherApi, targetUsername);
  });
});
