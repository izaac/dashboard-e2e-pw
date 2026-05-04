import { test, expect } from '@/support/fixtures';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import UsersPo from '@/e2e/po/pages/users-and-auth/users.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import { SHORT_TIMEOUT_OPT } from '@/support/timeouts';
import { LONG, STANDARD } from '@/support/timeouts';

const runTimestamp = Date.now();
const runPrefix = `e2e-test-${runTimestamp}`;

/**
 * Delete a user by username via v3 filtered query.
 * Silently ignores errors so cleanup never fails the test.
 */
async function deleteUserByUsername(api: RancherApi, username: string): Promise<void> {
  try {
    const resp = await api.getRancherResource('v3', `users?username=${username}`, undefined, 0);
    const user = resp.body?.data?.[0];

    if (user) {
      await api.deleteRancherResource('v3', 'users', user.id, false);
    }
  } catch {
    // Cleanup must not fail the test
  }
}

test.describe('Users', { tag: ['@usersAndAuths', '@adminUser'] }, () => {
  test('can create Admin', async ({ page, login, rancherApi }) => {
    const adminUsername = `${runPrefix}-admin-user-${Date.now()}`;
    const adminPassword = 'admin-password';

    await login();

    const usersPo = new UsersPo(page);

    try {
      await usersPo.goTo();
      await usersPo.waitForPage();

      const burgerMenu = new BurgerMenuPo(page);

      await expect(burgerMenu.menuItemWrapper('Users & Authentication')).toHaveClass(/active-menu-link/);

      await usersPo.list().create();

      const userCreate = usersPo.createEdit();

      await userCreate.waitForPage();
      await userCreate.username().set(adminUsername);
      await userCreate.newPass().set(adminPassword);
      await userCreate.confirmNewPass().set(adminPassword);
      await userCreate.selectCheckbox('Administrator').set();
      await userCreate.saveAndWaitForRequests('POST', '/v3/globalrolebindings');
    } finally {
      await deleteUserByUsername(rancherApi, adminUsername);
    }
  });

  test('can create User-Base', async ({ page, login, rancherApi }) => {
    const userBaseUsername = `${runPrefix}-userBase-${Date.now()}`;
    const userBasePassword = 'userBase-password';

    await login();

    const usersPo = new UsersPo(page);

    try {
      await usersPo.goTo();
      await usersPo.waitForPage();
      await usersPo.list().create();

      const userCreate = usersPo.createEdit();

      await userCreate.waitForPage();
      await userCreate.username().set(userBaseUsername);
      await userCreate.newPass().set(userBasePassword);
      await userCreate.confirmNewPass().set(userBasePassword);
      await userCreate.selectCheckbox('User-Base').set();
      await userCreate.saveAndWaitForRequests('POST', '/v3/globalrolebindings');

      await usersPo.waitForPage();
      await expect(usersPo.list().elementWithName(userBaseUsername)).toBeVisible();
    } finally {
      await deleteUserByUsername(rancherApi, userBaseUsername);
    }
  });

  test('can create Standard User and view their details', async ({ page, login, rancherApi }) => {
    const standardUsername = `${runPrefix}-standard-${Date.now()}`;
    const standardPassword = 'standardUser-password';

    await login();

    const usersPo = new UsersPo(page);

    await usersPo.goTo();
    await usersPo.waitForPage();
    await usersPo.list().create();

    const userCreate = usersPo.createEdit();

    await userCreate.username().set(standardUsername);
    await userCreate.newPass().set(standardPassword);
    await userCreate.confirmNewPass().set(standardPassword);

    // verify standard user checkbox selected by default
    await expect(userCreate.selectCheckbox('Standard User').checkboxCustom()).toHaveAttribute('aria-checked', 'true');

    const response = await userCreate.saveAndWaitForRequests('POST', '/v3/globalrolebindings');
    const body = await response.json();
    const userId = body.userId;

    try {
      await usersPo.waitForPage();
      await expect(usersPo.list().elementWithName(standardUsername)).toBeVisible();

      // view user's details
      await usersPo.list().detailLink(standardUsername, 2).click();

      const userDetails = usersPo.detail(userId);

      await userDetails.waitForPage();
      await expect(userDetails.mastheadTitle()).toContainText(standardUsername);
    } finally {
      await rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', userId, false);
    }
  });

  test('shows global roles in specific order', async ({ page, login }) => {
    await login();

    const usersPo = new UsersPo(page);

    // Route intercept must be registered after login but before navigation
    await page.route('**/v1/management.cattle.io.globalroles?*', async (route) => {
      const response = await route.fetch();
      const body = await response.json();

      const adminIndex = body.data.findIndex((item: any) => item.id === 'admin');

      if (adminIndex !== -1) {
        const adminRole = body.data.splice(adminIndex, 1)[0];

        body.data.push(adminRole);
      }

      await route.fulfill({ json: body });
    });

    await usersPo.goTo();
    await usersPo.waitForPage();
    await usersPo.list().create();

    const userCreate = usersPo.createEdit();

    await userCreate.waitForPage();

    // Global role checkboxes load asynchronously — wait before reading option labels
    await expect(userCreate.globalRoleBindings().globalOptionsLocator()).not.toHaveCount(0);

    const options = await userCreate.globalRoleBindings().globalOptions();

    expect(options.length).toBe(3);
    expect(options[0]).toBe('Administrator');
    expect(options[1]).toBe('Standard User');
    expect(options[2]).toBe('User-Base');
  });

  test('can Refresh Group Memberships', async ({ page, login }) => {
    await login();

    const usersPo = new UsersPo(page);

    await usersPo.goTo();
    await usersPo.waitForPage();

    const responsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/v1/ext.cattle.io.groupmembershiprefreshrequests') && resp.request().method() === 'POST',
    );

    await usersPo.list().refreshGroupMembership().self().click();

    const response = await responsePromise;

    expect(response.status()).toBe(201);
  });

  test.describe('Action Menu', () => {
    let actualUsername: string;
    let userId: string;

    test.beforeEach(async ({ rancherApi }) => {
      const userResp = await rancherApi.createUser({
        username: `action-${Date.now()}`,
        globalRole: { role: 'user' },
        password: 'standardUser-password',
      });

      userId = userResp.body.id;
      actualUsername = userResp.body.username;
    });

    test.afterEach(async ({ rancherApi }) => {
      if (userId) {
        await rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', userId, false);
      }
    });

    test('can Deactivate and Activate user', async ({ page, login }) => {
      await login();

      const usersPo = new UsersPo(page);

      const usersResponse = page.waitForResponse(
        (resp) =>
          resp.url().includes('/v1/management.cattle.io.users') &&
          resp.request().method() === 'GET' &&
          resp.status() === 200,
      );

      await usersPo.goTo();
      await usersPo.waitForPage();
      await usersResponse;

      // Deactivate user
      const deactivateMenu = await usersPo.list().actionMenu(actualUsername);

      await deactivateMenu.getMenuItem('Disable').click();

      await expect(usersPo.list().statusIcon(actualUsername, 1)).toHaveClass(/icon-user-xmark/);

      // Action menu must close before opening a new one, otherwise the next click targets the old menu
      await expect(usersPo.list().actionMenuDropdown()).not.toBeAttached();

      // Activate user
      const activateMenu = await usersPo.list().actionMenu(actualUsername);

      await activateMenu.getMenuItem('Enable').click();

      await expect(usersPo.list().statusIcon(actualUsername, 1)).toHaveClass(/icon-user-check/);
    });

    test('can Refresh Group Memberships via action menu', async ({ page, login }) => {
      await login();

      const usersPo = new UsersPo(page);

      await usersPo.goTo();
      await usersPo.waitForPage();

      const responsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('/v1/ext.cattle.io.groupmembershiprefreshrequests') && resp.request().method() === 'POST',
      );

      await usersPo.list().clickRowActionMenuItem(actualUsername, 'Refresh Group Memberships');

      const response = await responsePromise;

      expect(response.status()).toBe(201);
    });

    test('can Edit Config', async ({ page, login }) => {
      await login();

      const usersPo = new UsersPo(page);

      await usersPo.goTo();
      await usersPo.waitForPage();

      await usersPo.list().clickRowActionMenuItem(actualUsername, 'Edit Config');

      const userEdit = usersPo.createEdit(userId);

      await userEdit.waitForPage();
      await expect(userEdit.mastheadTitle()).toContainText(actualUsername);

      await userEdit.description().set('e2e_test');

      const response = await userEdit.saveAndWaitForRequests('PUT', `/v1/management.cattle.io.users/${userId}`);

      expect(response.status()).toBe(200);
      const body = await response.json();

      expect(body.description).toBe('e2e_test');
    });

    test('can Edit YAML', async ({ page, login }) => {
      await login();

      const usersPo = new UsersPo(page);

      await usersPo.goTo();
      await usersPo.waitForPage();

      await usersPo.list().clickRowActionMenuItem(actualUsername, 'Edit YAML');

      await expect(page).toHaveURL(/mode=edit&as=yaml/);

      const viewYaml = usersPo.createEdit(userId);

      await expect(viewYaml.mastheadTitle()).toContainText(actualUsername);
    });

    test('can Download YAML', async ({ page, login }) => {
      await login();

      const usersPo = new UsersPo(page);

      await usersPo.goTo();
      await usersPo.waitForPage();

      const downloadPromise = page.waitForEvent('download');

      await usersPo.list().clickRowActionMenuItem(actualUsername, 'Download YAML');

      const download = await downloadPromise;
      const path = await download.path();

      expect(path).toBeTruthy();

      const fs = await import('fs');
      const jsyaml = await import('js-yaml');
      const content = fs.readFileSync(path!, 'utf8');
      const obj: any = jsyaml.load(content);

      expect(obj.username).toBe(actualUsername);
      expect(obj.apiVersion).toBe('management.cattle.io/v3');
    });

    test('can Delete user', async ({ page, login }) => {
      await login();

      const usersPo = new UsersPo(page);

      await usersPo.goTo();
      await usersPo.waitForPage();

      await usersPo.list().clickRowActionMenuItem(actualUsername, 'Delete');

      const promptRemove = new PromptRemove(page);

      const deletePromise = page.waitForResponse(
        (resp) => resp.url().includes('/v1/management.cattle.io.users/') && resp.request().method() === 'DELETE',
      );

      await promptRemove.confirm(actualUsername);
      await promptRemove.remove();

      const deleteResp = await deletePromise;

      expect([200, 204]).toContain(deleteResp.status());

      await expect(usersPo.list().elementWithName(actualUsername)).not.toBeAttached();

      // User already deleted, clear userId so afterEach doesn't fail
      userId = '';
    });
  });

  test.describe('Bulk Actions', () => {
    let actualUsername: string;
    let userBaseId: string;

    test.beforeEach(async ({ rancherApi }) => {
      const userResp = await rancherApi.createUser({
        username: `bulk-${Date.now()}`,
        globalRole: { role: 'user-base' },
        password: 'userBase-password',
      });

      userBaseId = userResp.body.id;
      actualUsername = userResp.body.username;
    });

    test.afterEach(async ({ rancherApi }) => {
      if (userBaseId) {
        await rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', userBaseId, false);
      }
    });

    test('can Deactivate and Activate users', async ({ page, login }) => {
      await login();

      const usersPo = new UsersPo(page);

      await usersPo.goTo();
      await usersPo.waitForPage();

      await usersPo.list().selectAll();

      // Deactivate
      const deactivatePromise = page.waitForResponse(
        (resp) => resp.url().includes('/v1/management.cattle.io.users/') && resp.request().method() === 'PUT',
      );

      await usersPo.list().deactivate().click();
      await deactivatePromise;

      // admin stays active (cannot self-deactivate)
      await expect(usersPo.list().statusIcon('admin', 1)).toHaveClass(/icon-user-check/);
      await expect(usersPo.list().statusIcon(actualUsername, 1)).toHaveClass(/icon-user-xmark/);

      // Activate
      const activatePromise = page.waitForResponse(
        (resp) => resp.url().includes('/v1/management.cattle.io.users/') && resp.request().method() === 'PUT',
      );

      await usersPo.list().activate().click();
      await activatePromise;

      await expect(usersPo.list().statusIcon(actualUsername, 1)).toHaveClass(/icon-user-check/);
    });

    test('can Download YAML', async ({ page, login }) => {
      await login();

      const usersPo = new UsersPo(page);

      await usersPo.goTo();
      await usersPo.waitForPage();

      await usersPo.list().selectAll();

      const downloadPromise = page.waitForEvent('download');

      await usersPo.list().resourceTable().sortableTable().bulkActionButton('Download YAML').click();

      const download = await downloadPromise;
      const path = await download.path();

      expect(path).toBeTruthy();
    });

    test('can Delete user via bulk', async ({ page, login }) => {
      await login();

      const usersPo = new UsersPo(page);

      await usersPo.goTo();
      await usersPo.waitForPage();

      await usersPo.list().rowCheckbox(actualUsername).click();
      await usersPo.list().resourceTable().sortableTable().bulkActionButton('Delete').click();

      const promptRemove = new PromptRemove(page);

      const deletePromise = page.waitForResponse(
        (resp) => resp.url().includes('/v1/management.cattle.io.users/') && resp.request().method() === 'DELETE',
      );

      await promptRemove.confirm(actualUsername);
      await promptRemove.remove();

      const deleteResp = await deletePromise;

      expect([200, 204]).toContain(deleteResp.status());

      await expect(usersPo.list().elementWithName(actualUsername)).not.toBeAttached();

      // User already deleted
      userBaseId = '';
    });
  });

  test('cannot delete admin user via action menu', async ({ page, login, rancherApi }) => {
    await login();

    const usersPo = new UsersPo(page);

    // Find the admin user's ID to match the table row link
    const adminResp = await rancherApi.getRancherResource('v3', 'users?username=admin', undefined, 0);
    const adminId = adminResp.body?.data?.[0]?.id;

    await usersPo.goTo();
    await usersPo.waitForPage();

    await usersPo.list().clickRowActionMenuItem(adminId, 'Delete');

    const promptRemove = new PromptRemove(page);

    await expect(promptRemove.self()).toBeVisible();
    await expect(promptRemove.self()).toContainText('Default Admin');
  });

  test('can change standard user password', async ({ page, login, rancherApi }) => {
    const username = `pwd-change-${Date.now()}`;
    const originalPassword = 'original-password-123';
    const newPassword = 'changed-password-456';

    const userResp = await rancherApi.createUser({
      username,
      globalRole: { role: 'user' },
      password: originalPassword,
    });
    const userId = userResp.body.id;
    const actualUsername = userResp.body.username;

    try {
      await login();

      const usersPo = new UsersPo(page);

      await usersPo.goTo();
      await usersPo.waitForPage();

      // Navigate to edit page directly (row matching uses user ID in link column)
      await usersPo.list().clickRowActionMenuItem(userId, 'Edit Config');

      const userEdit = usersPo.createEdit(userId);

      await userEdit.waitForPage();
      await userEdit.newPass().set(newPassword);
      await userEdit.confirmNewPass().set(newPassword);

      const response = await userEdit.saveAndWaitForRequests('PUT', `/v1/management.cattle.io.users/${userId}`);

      expect(response.status()).toBe(200);

      // Verify login with new password by logging out and back in
      await page.goto('./auth/logout', { waitUntil: 'domcontentloaded' });
      await login({ username: actualUsername, password: newPassword });
      await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: LONG });
    } finally {
      await rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', userId, false);
    }
  });

  test('user deletion via bulk removes only selected user', async ({ page, login, rancherApi }) => {
    const user1Name = `bulk-del-a-${Date.now()}`;
    const user2Name = `bulk-del-b-${Date.now()}`;

    const user1Resp = await rancherApi.createUser({
      username: user1Name,
      globalRole: { role: 'user' },
      password: 'password-123',
    });
    const user1Id = user1Resp.body.id;

    const user2Resp = await rancherApi.createUser({
      username: user2Name,
      globalRole: { role: 'user' },
      password: 'password-123',
    });
    const user2Id = user2Resp.body.id;

    let user1Deleted = false;

    try {
      await login();

      const usersPo = new UsersPo(page);

      await usersPo.goTo();
      await usersPo.waitForPage();

      // Select only user1 by user ID (rendered as link in table)
      await usersPo.list().rowCheckbox(user1Id).click();
      await usersPo.list().resourceTable().sortableTable().bulkActionButton('Delete').click();

      const promptRemove = new PromptRemove(page);

      await expect(promptRemove.self()).toBeVisible();

      // Get the user's display name from the API for the confirmation prompt
      const userData = await rancherApi.getRancherResource('v1', 'management.cattle.io.users', user1Id);
      const user1DisplayName = userData.body.name || userData.body.username;

      await promptRemove.confirm(user1DisplayName);

      const deletePromise = page.waitForResponse(
        (resp) => resp.url().includes('/v1/management.cattle.io.users/') && resp.request().method() === 'DELETE',
      );

      await promptRemove.remove();

      const deleteResp = await deletePromise;

      expect([200, 204]).toContain(deleteResp.status());

      await expect(usersPo.list().elementWithName(user1Id)).not.toBeAttached();
      await expect(usersPo.list().elementWithName(user2Id)).toBeAttached();

      user1Deleted = true;
    } finally {
      if (!user1Deleted) {
        await rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', user1Id, false);
      }
      await rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', user2Id, false);
    }
  });

  test.describe('Create admin user with standard user', { tag: ['@flaky'] }, () => {
    test('User creation should complete after admin user fails to create for Standard user with Manage Users Role', async ({
      page,
      login,
      rancherApi,
    }) => {
      const standardUsername = `manage-users-${Date.now()}`;
      const standardPassword = 'standardUser-password';

      await login();

      const usersPo = new UsersPo(page);

      await usersPo.goTo();
      await usersPo.waitForPage();
      await usersPo.list().create();

      const userCreate = usersPo.createEdit();

      await userCreate.username().set(standardUsername);
      await userCreate.newPass().set(standardPassword);
      await userCreate.confirmNewPass().set(standardPassword);
      await userCreate.selectCheckbox('Manage Users').set();

      // Two globalrolebinding POSTs will be made (Standard User + Manage Users)
      const firstBinding = page.waitForResponse(
        (resp) =>
          resp.url().includes('/v3/globalrolebindings') && resp.request().method() === 'POST' && resp.status() === 201,
      );

      await userCreate.resourceDetail().cruResource().saveOrCreate().click();
      await firstBinding;

      // Second globalrolebinding POST may already have resolved before we start listening
      await page
        .waitForResponse(
          (resp) =>
            resp.url().includes('/v3/globalrolebindings') &&
            resp.request().method() === 'POST' &&
            resp.status() === 201,
          { timeout: STANDARD },
        )
        .catch(() => {
          // Second role binding POST may have already resolved before waitForResponse attached
        });

      await usersPo.goTo();
      await usersPo.waitForPage();
      await expect(usersPo.list().elementWithName(standardUsername)).toBeAttached(SHORT_TIMEOUT_OPT);

      // Logout admin and login as the standard user
      await page.goto('./auth/logout', { waitUntil: 'domcontentloaded' });
      await login({ username: standardUsername, password: standardPassword });

      await usersPo.goTo();
      await usersPo.waitForPage();
      await usersPo.list().create();

      const adminUsername = `admin-from-std-${Date.now()}`;
      const adminPassword = 'admin-password';

      const adminCreate = usersPo.createEdit();

      await adminCreate.username().set(adminUsername);
      await adminCreate.newPass().set(adminPassword);
      await adminCreate.confirmNewPass().set(adminPassword);
      await adminCreate.selectCheckbox('Administrator').set();

      // Standard user can't assign Admin — expect 403 on the admin globalrolebinding POST
      const adminBindingFail = page.waitForResponse(
        (resp) =>
          resp.url().includes('/v3/globalrolebindings') && resp.request().method() === 'POST' && resp.status() === 403,
        SHORT_TIMEOUT_OPT,
      );

      await adminCreate.resourceDetail().cruResource().saveOrCreate().click();
      await adminBindingFail;

      await expect(adminCreate.errorBanner()).toBeVisible();
      await expect(adminCreate.errorBanner()).toContainText(
        'You cannot assign Global Permissions that are higher than your own',
      );

      await adminCreate.selectCheckbox('Administrator').uncheck();
      await adminCreate.selectCheckbox('User-Base').set();
      await adminCreate.saveAndWaitForRequests('POST', '/v3/globalrolebindings');

      await usersPo.goTo();
      await usersPo.waitForPage();
      await expect(usersPo.list().elementWithName(adminUsername)).toBeAttached(SHORT_TIMEOUT_OPT);

      // Cleanup: delete both test users via API
      for (const username of [standardUsername, adminUsername]) {
        await deleteUserByUsername(rancherApi, username);
      }
    });
  });

  test.describe('List and Pagination', () => {
    // 26 seed users + per-page preference are shared across the four tests via
    // beforeAll/afterAll. Run serial so parallel workers don't race the shared
    // setup (and so a per-test failure leaves the chain in a recoverable state).
    test.describe.configure({ mode: 'serial' });

    // Tests share an API-created pool of users; each test navigates fresh to the
    // Users page so they remain atomic. afterAll resets prefs and deletes users
    // even if a test fails mid-run.

    const USERS_PER_PAGE = 10;
    const NAME_COLUMN = 3; // [checkbox, state, ?, Name, ...] — Name column index in <th> nth(...)
    const pageTimestamp = Date.now();
    const userPrefix = `e2e-pgn-${pageTimestamp}`;
    // 'aaa-' prefix sorts ahead of 'e2e-' in ASC; reused as a sort/filter anchor
    const uniqueUsername = `aaa-${userPrefix}-unique`;
    const createdUserIds: string[] = [];
    let savedPerPage: string | undefined;

    test.beforeAll(async ({ rancherApi }) => {
      // Pre-clean any leftover pagination-pool users from a prior run. Without
      // this, orphaned `e2e-pgn-*` users inflate the list count and tests that
      // rely on a stable filter-result count flake on dirty environments.
      const allUsers = await rancherApi.getRancherResource('v1', 'management.cattle.io.users');

      if (allUsers.body?.data) {
        const orphanIds: string[] = allUsers.body.data
          .filter((u: any) => typeof u?.username === 'string' && u.username.startsWith('e2e-pgn-'))
          .map((u: any) => u.id as string);

        await Promise.all(
          orphanIds.map((id) => rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', id, false)),
        );
      }

      // Save per-page so afterAll can restore even if a test mutates it
      const prefsResp = await rancherApi.getRancherResource('v1', 'userpreferences');

      savedPerPage = prefsResp.body.data[0]?.data?.['per-page'];
      await rancherApi.setUserPreference({ 'per-page': String(USERS_PER_PAGE) });

      const usernames = [
        ...Array.from({ length: 25 }, (_, i) => `${userPrefix}-${String(i).padStart(2, '0')}`),
        uniqueUsername,
      ];

      const ids = await Promise.all(
        usernames.map(async (name) => {
          const resp = await rancherApi.createRancherResource('v1', 'management.cattle.io.users', {
            type: 'user',
            enabled: true,
            mustChangePassword: false,
            username: name,
          });

          return resp.body.id as string;
        }),
      );

      createdUserIds.push(...ids);

      // Wait for etcd to settle: total user count must exceed 26 (our pool) before UI tests run
      const settled = await rancherApi.waitForRancherResources('v1', 'management.cattle.io.users', 26, true);

      if (!settled) {
        throw new Error('User count did not exceed 26 in the v1 users API after creation');
      }
    });

    test.afterAll(async ({ rancherApi }) => {
      for (const id of createdUserIds) {
        await rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', id, false);
      }
      await rancherApi.setUserPreference({ 'per-page': savedPerPage ?? '100' });
    });

    test('pagination is visible and user is able to navigate through users data', async ({ page, login }) => {
      await login();

      const usersPo = new UsersPo(page);

      await usersPo.goTo();
      await usersPo.waitForPage();

      const table = usersPo.list().resourceTable().sortableTable();

      await table.checkLoadingIndicatorNotVisible();

      // Filter to the deterministic test pool (26 users) so total is independent of
      // existing users in the cluster
      await table.filter(userPrefix);
      await table.checkLoadingIndicatorNotVisible();
      await expect(table.paginationText()).toContainText(`1 - ${USERS_PER_PAGE} of 26`);

      // Page 1 — beginning/prev disabled, next/end enabled
      await expect(table.pagination()).toBeVisible();
      await expect(table.paginationBeginButton()).toBeDisabled();
      await expect(table.paginationPrevButton()).toBeDisabled();
      await expect(table.paginationNextButton()).toBeEnabled();
      await expect(table.paginationEndButton()).toBeEnabled();

      // Next → page 2
      await table.paginationNextButton().click();
      await expect(table.paginationText()).toContainText('11 - 20 of 26');
      await expect(table.paginationBeginButton()).toBeEnabled();
      await expect(table.paginationPrevButton()).toBeEnabled();

      // Prev → page 1
      await table.paginationPrevButton().click();
      await expect(table.paginationText()).toContainText(`1 - ${USERS_PER_PAGE} of 26`);
      await expect(table.paginationBeginButton()).toBeDisabled();
      await expect(table.paginationPrevButton()).toBeDisabled();

      // End → last page (rows 21-26)
      await table.paginationEndButton().click();
      await expect(table.paginationText()).toContainText('21 - 26 of 26');
      await expect(table.paginationNextButton()).toBeDisabled();
      await expect(table.paginationEndButton()).toBeDisabled();

      // Beginning → page 1
      await table.paginationBeginButton().click();
      await expect(table.paginationText()).toContainText(`1 - ${USERS_PER_PAGE} of 26`);
      await expect(table.paginationBeginButton()).toBeDisabled();
    });

    test('filter users', async ({ page, login }) => {
      await login();

      const usersPo = new UsersPo(page);

      await usersPo.goTo();
      await usersPo.waitForPage();

      const table = usersPo.list().resourceTable().sortableTable();

      await table.checkLoadingIndicatorNotVisible();

      // Filter by exact unique name → 1 result
      await table.filter(uniqueUsername);
      await expect(table.rowElements()).toHaveCount(1);
      await expect(table.rowElementWithName(uniqueUsername)).toBeVisible();

      // Filter by run prefix → all 26 users in the test pool
      await table.filter(userPrefix);
      await expect(table.paginationText()).toContainText('of 26');
    });

    test('sorting changes the order of paginated users data', async ({ page, login }) => {
      await login();

      const usersPo = new UsersPo(page);

      await usersPo.goTo();
      await usersPo.waitForPage();

      const table = usersPo.list().resourceTable().sortableTable();

      await table.checkLoadingIndicatorNotVisible();

      // Constrain to our pool so order is deterministic
      await table.filter(userPrefix);
      await table.checkLoadingIndicatorNotVisible();

      // Default ASC by Name — 'aaa-...' is the lexicographic first row → page 1
      await expect(table.sortIcon(NAME_COLUMN, 'down')).toBeVisible();
      await expect(table.rowElementWithName(uniqueUsername)).toBeVisible();

      // Last page → 'aaa-...' must NOT appear
      await table.paginationEndButton().click();
      await expect(table.rowElementWithName(uniqueUsername)).toBeHidden();

      // Toggle to DESC by clicking Name column sort handle. Sort toggle resets to page 1.
      await table.sort(NAME_COLUMN).click();
      await table.checkLoadingIndicatorNotVisible();
      await expect(table.sortIcon(NAME_COLUMN, 'up')).toBeVisible();

      // Page 1 in DESC: 'aaa-...' must NOT appear (the highest-sorting prefix is 'e2e-pgn-...')
      await expect(table.paginationBeginButton()).toBeDisabled();
      await expect(table.rowElementWithName(uniqueUsername)).toBeHidden();

      // Last page in DESC → 'aaa-...' bubbles to the end
      await table.paginationEndButton().click();
      await expect(table.rowElementWithName(uniqueUsername)).toBeVisible();
    });

    test('pagination is hidden', async ({ page, login }) => {
      await login();

      // Mock the users API to return a 3-row collection so total < per-page → no pagination
      await page.route('**/v1/management.cattle.io.users?**', (route) => {
        const ts = new Date().toISOString();
        const items = Array.from({ length: 3 }, (_, i) => ({
          id: `mock-user-${i}`,
          type: 'management.cattle.io.user',
          username: `mock-user-${i}`,
          principalIds: [`local://mock-user-${i}`],
          metadata: {
            name: `mock-user-${i}`,
            uid: `uid-mock-${i}`,
            creationTimestamp: ts,
            state: {
              name: 'active',
              error: false,
              transitioning: false,
            },
          },
          spec: {},
        }));

        route.fulfill({
          json: {
            type: 'collection',
            resourceType: 'management.cattle.io.user',
            count: items.length,
            data: items,
          },
        });
      });

      const usersPo = new UsersPo(page);

      await usersPo.goTo();
      await usersPo.waitForPage();

      const table = usersPo.list().resourceTable().sortableTable();

      await table.checkLoadingIndicatorNotVisible();
      await expect(table.rowElements()).toHaveCount(3);
      await expect(table.pagination()).toBeHidden();
    });
  });
});
