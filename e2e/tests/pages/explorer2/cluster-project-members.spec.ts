import { test, expect } from '@/support/fixtures';
import ClusterProjectMembersPo from '@/e2e/po/pages/explorer/cluster-project-members.po';
import HomePagePo from '@/e2e/po/pages/home.po';

test.describe('Cluster Project and Members', { tag: ['@explorer2', '@adminUser'] }, () => {
  test('Members added to Cluster Membership should not show Loading next to their names', async ({
    page,
    login,
    rancherApi,
  }) => {
    await login();
    const username = `e2e-test-${Date.now()}-cluster-member`;
    const userResp = await rancherApi.createUser(
      { username, globalRole: { role: 'user' }, password: 'standard-password' },
      { createNameOptions: { onlyContext: true } },
    );

    try {
      const homePage = new HomePagePo(page);

      await homePage.goTo();

      const clusterMembership = new ClusterProjectMembersPo(page, 'local', 'cluster-membership');

      await clusterMembership.navToClusterMenuEntry('local');
      await clusterMembership.waitForPageWithSpecificUrl('/c/local/explorer');
      await clusterMembership.navToSideMenuEntryByLabel('Cluster and Project Members');
      await clusterMembership.triggerAddClusterOrProjectMemberAction();

      await clusterMembership.selectClusterOrProjectMember(username);

      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/v3/clusterroletemplatebindings') && resp.request().method() === 'POST',
      );

      await clusterMembership.saveCreateForm().click();
      await responsePromise;

      await clusterMembership.waitForPageWithExactUrl();

      await expect(clusterMembership.listElementWithName(username)).toBeVisible({ timeout: 15000 });
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
    const userResp = await rancherApi.createUser(
      { username, globalRole: { role: 'user' }, password: 'standard-password' },
      { createNameOptions: { onlyContext: true } },
    );

    try {
      const projectMembership = new ClusterProjectMembersPo(page, 'local', 'project-membership');

      await projectMembership.goTo();
      await projectMembership.waitForPageWithSpecificUrl('/c/local/explorer/members#project-membership');
      await projectMembership.triggerAddProjectMemberAction('default');
      await projectMembership.selectProjectCustomPermission();
      await projectMembership.selectClusterOrProjectMember(username);
      await projectMembership.checkTheseProjectCustomPermissions([0, 1]);

      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/v3/projectroletemplatebindings') && resp.request().method() === 'POST',
      );

      await projectMembership.submitProjectCreateButton();
      await responsePromise;

      await expect(projectMembership.modalOverlay()).not.toBeAttached({ timeout: 15000 });
    } finally {
      await rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', userResp.body.id, false);
    }
  });
});
