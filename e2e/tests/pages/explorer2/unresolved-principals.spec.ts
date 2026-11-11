import { test, expect } from '@/support/fixtures';
import ClusterProjectMembersPo from '@/e2e/po/pages/explorer/cluster-project-members.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';

test.describe('Unresolved Principal ID Display', { tag: ['@explorer2', '@adminUser'] }, () => {
  let projectId = '';
  let crtbId = '';

  test.beforeAll(async ({ rancherApi }) => {
    const projectResp = await rancherApi.createRancherResource('v3', 'projects', {
      name: 'qa-18795-p',
      clusterId: 'local',
    });

    projectId = projectResp.body.id;

    await rancherApi.createRancherResource('v3', 'projectroletemplatebindings', {
      projectId,
      roleTemplateId: 'project-member',
      groupPrincipalId: 'github_team://8087745',
    });

    await rancherApi.createRancherResource('v3', 'projectroletemplatebindings', {
      projectId,
      roleTemplateId: 'project-member',
      groupPrincipalId: 'okta_group://auditors',
    });

    // Rancher rejects a binding for a user principal whose User object does not exist yet
    // (users.management.cattle.io "ghost123" not found), so seed a bare User first.
    await rancherApi.createRancherResource(
      'v1',
      'management.cattle.io.users',
      { metadata: { name: 'ghost123' }, username: 'ghost123', displayName: 'ghost123' },
      false,
    );

    await rancherApi.createRancherResource('v3', 'projectroletemplatebindings', {
      projectId,
      roleTemplateId: 'project-member',
      userPrincipalId: 'github_user://ghost123',
    });

    await rancherApi.createRancherResource('v3', 'projectroletemplatebindings', {
      projectId,
      roleTemplateId: 'project-member',
      groupPrincipalId: 'openldap_group://cn=engineering,ou=groups,dc=example,dc=org',
    });

    const crtbResp = await rancherApi.createRancherResource('v3', 'clusterroletemplatebindings', {
      clusterId: 'local',
      roleTemplateId: 'cluster-member',
      groupPrincipalId: 'github_team://8087745',
    });

    crtbId = crtbResp.body.id;
  });

  test.afterAll(async ({ rancherApi }) => {
    if (crtbId) {
      await rancherApi.deleteRancherResource('v3', 'clusterroletemplatebindings', crtbId, false);
    }

    if (projectId) {
      await rancherApi.deleteRancherResource('v3', 'projects', projectId, false);
    }

    await rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', 'ghost123', false);

    // The binding controller materialises its own user record for the principal; remove it too.
    const users = await rancherApi.getRancherResource('v1', 'management.cattle.io.users', '', 200);

    for (const user of users.body?.data || []) {
      if ((user.principalIds || []).includes('github_user://ghost123')) {
        await rancherApi.deleteRancherResource('v1', 'management.cattle.io.users', user.id, false);
      }
    }
  });

  test.beforeEach(async ({ page, login }) => {
    await login();
    await new WelcomeDialogPo(page).dismissIfVisible();
  });

  test('should display question mark avatar and readable ID for unresolvable group principals in Project Membership', async ({
    page,
  }) => {
    const membersPage = new ClusterProjectMembersPo(page, 'local', 'project-membership');

    await membersPage.goTo();
    await membersPage.projectMembershipTab().click();

    await expect(membersPage.unresolvedPrincipal('github_team 8087745')).toBeVisible();
    await expect(membersPage.unresolvedPrincipal('okta_group auditors')).toBeVisible();
    await expect(membersPage.principalQuestionMark('github_team 8087745')).toBeVisible();
    await expect(membersPage.principalQuestionMark('okta_group auditors')).toBeVisible();
    await expect(page.getByText('Unable to fetch principal info')).toHaveCount(0);
  });

  test('should display info tooltip on hover of unresolvable principal info icon', async ({ page }) => {
    const membersPage = new ClusterProjectMembersPo(page, 'local', 'project-membership');

    await membersPage.goTo();
    await membersPage.projectMembershipTab().click();

    await membersPage.principalInfoIcon('github_team 8087745').hover();

    await expect(membersPage.tooltip()).toBeVisible();
    await expect(membersPage.tooltip()).toContainText(/principal ID is shown instead|could not look up/i);
  });

  test('should dismiss tooltip when pressing Escape key', async ({ page }) => {
    const membersPage = new ClusterProjectMembersPo(page, 'local', 'project-membership');

    await membersPage.goTo();
    await membersPage.projectMembershipTab().click();

    await membersPage.principalInfoIcon('okta_group auditors').hover();
    await expect(membersPage.tooltip()).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(membersPage.tooltip()).toBeHidden();
  });

  test('should resolve the display of a user principal from the management user list', async ({ page }) => {
    const membersPage = new ClusterProjectMembersPo(page, 'local', 'project-membership');

    await membersPage.goTo();
    await membersPage.projectMembershipTab().click();

    // Rancher materialises a management user for every user principal binding, so a user
    // principal is never displayed as unresolved: it resolves through the user list fallback.
    const userRow = membersPage.resolvedPrincipal('ghost123');

    await expect(membersPage.principalName(userRow)).toHaveText('ghost123');
    await expect(membersPage.principalName(userRow)).not.toHaveClass(/unresolved/);
    await expect(membersPage.principalQuestionMarkIn(userRow)).toHaveCount(0);
    await expect(membersPage.unresolvedPrincipal('github_user ghost123')).toHaveCount(0);
  });

  test('should format complex LDAP DN into readable text without crashing', async ({ page }) => {
    const membersPage = new ClusterProjectMembersPo(page, 'local', 'project-membership');

    await membersPage.goTo();
    await membersPage.projectMembershipTab().click();

    await expect(
      membersPage.unresolvedPrincipal('openldap_group cn=engineering,ou=groups,dc=example,dc=org'),
    ).toBeVisible();
    await expect(
      membersPage.principalQuestionMark('openldap_group cn=engineering,ou=groups,dc=example,dc=org'),
    ).toBeVisible();
  });

  test('should display question mark avatar and info tooltip on Cluster Membership tab', async ({ page }) => {
    const membersPage = new ClusterProjectMembersPo(page, 'local', 'cluster-membership');

    await membersPage.goTo();
    await membersPage.clusterMembershipTab().click();

    const panel = membersPage.clusterMembershipPanel();

    await expect(membersPage.unresolvedPrincipal('github_team 8087745', panel)).toBeVisible();
    await expect(membersPage.principalQuestionMark('github_team 8087745', panel)).toBeVisible();

    await membersPage.principalInfoIcon('github_team 8087745', panel).hover();

    await expect(membersPage.tooltip()).toBeVisible();
    await expect(membersPage.tooltip()).toContainText(/principal ID is shown instead|could not look up/i);
  });
});
