import { test, expect } from '@/support/fixtures';
import ClusterProjectMembersPo from '@/e2e/po/pages/explorer/cluster-project-members.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';

test.describe('Unresolved Principal ID Display', { tag: ['@explorer2', '@adminUser'] }, () => {
  let projectId = '';

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
  });

  test.afterAll(async ({ rancherApi }) => {
    if (projectId) {
      await rancherApi.deleteRancherResource('v3', 'projects', projectId, false);
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
});
