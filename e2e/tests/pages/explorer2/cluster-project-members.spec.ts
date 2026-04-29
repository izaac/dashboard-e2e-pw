import { test, expect } from '@/support/fixtures';
import ClusterProjectMembersPo from '@/e2e/po/pages/explorer/cluster-project-members.po';
import HomePagePo from '@/e2e/po/pages/home.po';
import UsersPo from '@/e2e/po/pages/users-and-auth/users.po';
import { SHORT_TIMEOUT_OPT } from '@/support/utils/timeouts';

test.describe('Cluster Project and Members', { tag: ['@explorer2', '@adminUser'] }, () => {
  test('Should create a new user', async ({ page, login, rancherApi }) => {
    await login();

    const username = `e2e-test-${Date.now()}-new-user`;
    const standardPassword = 'standard-password';

    const userResp = await rancherApi.createUser({
      username,
      globalRole: { role: 'user' },
      password: standardPassword,
    });

    try {
      const usersPage = new UsersPo(page);

      await usersPage.waitForRequests();
      await usersPage.waitForPage();

      const actualUsername = userResp.body.username;
      const sortableTable = usersPage.list().resourceTable().sortableTable();

      await expect(sortableTable.self()).toBeVisible();
      await expect(sortableTable.rowElementWithName(actualUsername)).toBeVisible(SHORT_TIMEOUT_OPT);
    } finally {
      await rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', userResp.body.id, false);
    }
  });

  test('Members added to Cluster Membership should not show Loading next to their names', async ({
    page,
    login,
    rancherApi,
  }) => {
    await login();
    const username = `e2e-test-${Date.now()}-cluster-member`;
    const userResp = await rancherApi.createUser({
      username,
      globalRole: { role: 'user' },
      password: 'standard-password',
    });

    const actualUsername = userResp.body.username;

    try {
      const homePage = new HomePagePo(page);

      await homePage.goTo();

      const clusterMembership = new ClusterProjectMembersPo(page, 'local', 'cluster-membership');

      await clusterMembership.navToClusterMenuEntry('local');
      await clusterMembership.waitForPageWithSpecificUrl('/c/local/explorer');
      await clusterMembership.navToSideMenuEntryByLabel('Cluster and Project Members');
      await clusterMembership.triggerAddClusterOrProjectMemberAction();

      await clusterMembership.selectClusterOrProjectMember(actualUsername);

      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/v3/clusterroletemplatebindings') && resp.request().method() === 'POST',
      );

      await clusterMembership.saveCreateForm().click();
      await responsePromise;

      await clusterMembership.waitForPageWithExactUrl();

      // Navigate fresh to ensure the list has the new binding (avoids stale WebSocket state)
      await clusterMembership.goTo();
      await clusterMembership.waitForPage();

      // Member list shows "{username} {clusterDisplayName}" — use partial match
      const sortableTable = clusterMembership.sortableTable();

      await expect(sortableTable.self()).toBeVisible();
      await expect(sortableTable.rowElementWithPartialName(actualUsername)).toBeVisible(SHORT_TIMEOUT_OPT);

      // Upstream parity: verify no "Loading..." text next to member name (issue #8804)
      const row = sortableTable.rowElementWithPartialName(actualUsername);

      await expect(clusterMembership.memberNameInRow(row)).not.toContainText('Loading');
    } finally {
      await rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', userResp.body.id, false);
    }
  });

  test('Clicking cancel should return to Cluster and Project members', async ({ page, login }) => {
    await login();
    const homePage = new HomePagePo(page);

    await homePage.goTo();

    const clusterMembership = new ClusterProjectMembersPo(page, 'local', 'cluster-membership');

    await clusterMembership.navToClusterMenuEntry('local');
    await clusterMembership.waitForPageWithSpecificUrl('/c/local/explorer');
    await clusterMembership.navToSideMenuEntryByLabel('Cluster and Project Members');
    await clusterMembership.triggerAddClusterOrProjectMemberAction();
    await clusterMembership.cancelCreateForm().click();
    await clusterMembership.waitForPageWithExactUrl();
  });

  test('Can create a member with custom permissions', async ({ page, login, rancherApi }) => {
    await login();
    const username = `e2e-test-${Date.now()}-proj-member`;
    const userResp = await rancherApi.createUser({
      username,
      globalRole: { role: 'user' },
      password: 'standard-password',
    });

    const actualUsername = userResp.body.username;

    try {
      const projectMembership = new ClusterProjectMembersPo(page, 'local', 'project-membership');

      await projectMembership.goTo();
      await projectMembership.waitForPageWithSpecificUrl('/c/local/explorer/members#project-membership');
      await projectMembership.triggerAddProjectMemberAction('default');
      await projectMembership.selectProjectCustomPermission();
      await projectMembership.selectClusterOrProjectMember(actualUsername);
      await projectMembership.checkTheseProjectCustomPermissions([0, 1]);

      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/v3/projectroletemplatebindings') && resp.request().method() === 'POST',
      );

      await projectMembership.submitProjectCreateButton();
      await responsePromise;

      await expect(projectMembership.modalOverlay()).not.toBeAttached(SHORT_TIMEOUT_OPT);
    } finally {
      await rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', userResp.body.id, false);
    }
  });
});
