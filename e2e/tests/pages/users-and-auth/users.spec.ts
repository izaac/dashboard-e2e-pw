import { test, expect } from '@/support/fixtures';
import UsersPo from '@/e2e/po/pages/users-and-auth/users.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';

const runTimestamp = Date.now();
const runPrefix = `e2e-test-${runTimestamp}`;

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

      await burgerMenu.checkIfMenuItemLinkIsHighlighted('Users & Authentication');

      await usersPo.list().create();

      const userCreate = usersPo.createEdit();

      await userCreate.waitForPage();
      await userCreate.username().set(adminUsername);
      await userCreate.newPass().set(adminPassword);
      await userCreate.confirmNewPass().set(adminPassword);
      await userCreate.selectCheckbox('Administrator').set();
      await userCreate.saveAndWaitForRequests('POST', '/v3/globalrolebindings');
    } finally {
      const usersResp = await rancherApi.getRancherResource('v1', 'management.cattle.io.users');
      const createdUser = usersResp.body.data.find((u: any) => u.username === adminUsername);

      if (createdUser) {
        await rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', createdUser.id, false);
      }
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
      const usersResp = await rancherApi.getRancherResource('v1', 'management.cattle.io.users');
      const createdUser = usersResp.body.data.find((u: any) => u.username === userBaseUsername);

      if (createdUser) {
        await rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', createdUser.id, false);
      }
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
    await userCreate.selectCheckbox('Standard User').isChecked();

    const response = await userCreate.saveAndWaitForRequests('POST', '/v3/globalrolebindings');
    const body = await response.json();
    const userId = body.userId;

    await usersPo.waitForPage();
    await expect(usersPo.list().elementWithName(standardUsername)).toBeVisible();

    // view user's details
    await usersPo.list().detailLink(standardUsername, 2).click();

    const userDetails = usersPo.detail(userId);

    await userDetails.waitForPage();
    await expect(userDetails.mastheadTitle()).toContainText(standardUsername);

    // Cleanup
    await rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', userId, false);
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
    const usersResp = await rancherApi.getRancherResource('v1', 'management.cattle.io.users');
    const adminUser = usersResp.body.data.find((u: any) => u.username === 'admin');
    const adminId = adminUser.id;

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
      await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 30000 });
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
          { timeout: 10000 },
        )
        .catch(() => {
          /* second binding may have already resolved */
        });

      await usersPo.goTo();
      await usersPo.waitForPage();
      await expect(usersPo.list().elementWithName(standardUsername)).toBeAttached({ timeout: 15000 });

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
        { timeout: 15000 },
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
      await expect(usersPo.list().elementWithName(adminUsername)).toBeAttached({ timeout: 15000 });

      // Cleanup: delete both test users via API (rancherApi is logged in as admin)
      const usersResp = await rancherApi.getRancherResource('v1', 'management.cattle.io.users');

      for (const username of [standardUsername, adminUsername]) {
        const user = usersResp.body.data.find((u: any) => u.username === username);

        if (user) {
          await rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', user.id, false);
        }
      }
    });
  });

  test.describe('List and Pagination', () => {
    test.skip(true, 'Requires setup of 26+ test users and rows-per-page config');
    test('pagination is visible and user is able to navigate through users data', async () => {
      // Upstream test creates 26 users, sets rows-per-page to 10, validates pagination UI
      // Port when pagination infrastructure is ready
    });

    test.skip(true, 'Requires setup of 26+ test users and rows-per-page config');
    test('filter users', async () => {
      // Upstream test filters by user ID and username
      // Port when pagination infrastructure is ready
    });

    test.skip(true, 'Requires setup of 26+ test users and rows-per-page config');
    test('sorting changes the order of paginated users data', async () => {
      // Upstream test sorts by name column and validates order across pages
      // Port when pagination infrastructure is ready
    });

    test.skip(true, 'Requires setup of 26+ test users and rows-per-page config');
    test('pagination is hidden', async () => {
      // Upstream test validates pagination UI hidden when user count < page size
      // Port when pagination infrastructure is ready
    });
  });
});
