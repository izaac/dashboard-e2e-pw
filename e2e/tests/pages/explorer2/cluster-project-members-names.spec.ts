import type { Locator, Page } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import ClusterProjectMembersPo from '@/e2e/po/pages/explorer/cluster-project-members.po';
import { LoginPagePo } from '@/e2e/po/pages/login-page.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';
import { LONG_TIMEOUT_OPT } from '@/support/timeouts';

/**
 * rancher/dashboard#18783 (fix PR #18786): Cluster and Project Members must show resolved user names for a
 * cluster owner, even when the direct principal lookup (GET /v3/principals/<id>) fails. The page falls back to
 * the management users list, which a user with User-Base + users-manage (or a cluster owner) can load.
 *
 * The lookup does not fail by itself on a healthy Rancher, so the specs force the failure from the browser:
 * `forbid` answers the by-id lookups with 403, `abort` kills them (what DevTools "Block request URL" does).
 */
test.describe(
  'Cluster and Project Members names without principal lookup',
  { tag: ['@explorer2', '@adminUser'] },
  () => {
    test.describe.configure({ mode: 'serial' });
    // Start unauthenticated: every test logs in itself as the user it needs, in its own fresh context
    test.use({ storageState: { cookies: [], origins: [] } });

    const CLUSTER_ID = 'local';
    const suffix = `${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 6)}`;
    const password = `E2e-Pass-${suffix}-Zz9!`;

    type QaUser = { key: 'owner' | 'plain' | 'member'; username: string; displayName: string; id: string };

    const users: Record<QaUser['key'], QaUser> = {
      owner: { key: 'owner', username: `e2e-owner${suffix}`, displayName: `E2E Owner ${suffix}`, id: '' },
      plain: { key: 'plain', username: `e2e-plain${suffix}`, displayName: `E2E Plain ${suffix}`, id: '' },
      member: { key: 'member', username: `e2e-member${suffix}`, displayName: `E2E Member ${suffix}`, id: '' },
    };
    const projectName = `e2e-p-${suffix}`;
    let projectId = '';

    /** "Display Name (username)" is how a resolved local user is rendered. */
    const resolvedLabel = (user: QaUser) => `${user.displayName} (${user.username})`;

    /**
     * Bind exactly the wanted global roles. New users get default roles asynchronously, so each poll iteration
     * reconciles (drops unwanted bindings, creates missing ones) and the set must then be seen equal on several
     * consecutive iterations, which also catches a late-arriving default role.
     */
    async function setGlobalRoles(rancherApi: RancherApi, user: QaUser, wanted: string[]) {
      const REQUIRED_STABLE_POLLS = 3;
      const sortedWanted = [...wanted].sort();
      let stablePolls = 0;

      const listBindings = async () => {
        const resp = await rancherApi.getRancherResource('v3', `globalrolebindings?userId=${user.id}&limit=1000`);

        return (resp.body?.data || []) as Array<{ id: string; globalRoleId: string }>;
      };

      await expect
        .poll(
          async () => {
            const bindings = await listBindings();

            for (const binding of bindings.filter((b) => !wanted.includes(b.globalRoleId))) {
              await rancherApi.deleteRancherResource('v3', 'globalrolebindings', binding.id, false);
            }

            const have = bindings.map((b) => b.globalRoleId);

            for (const role of wanted.filter((r) => !have.includes(r))) {
              await rancherApi.createRancherResource('v3', 'globalrolebindings', {
                type: 'globalRoleBinding',
                globalRoleId: role,
                userId: user.id,
              });
            }

            const current = (await listBindings()).map((b) => b.globalRoleId).sort();

            stablePolls = JSON.stringify(current) === JSON.stringify(sortedWanted) ? stablePolls + 1 : 0;

            return stablePolls >= REQUIRED_STABLE_POLLS ? current : [`unstable after ${stablePolls} equal polls`];
          },
          { timeout: 60_000, intervals: [1_000] },
        )
        .toEqual(sortedWanted);
    }

    async function createQaUser(rancherApi: RancherApi, user: QaUser, globalRoles: string[]) {
      const resp = await rancherApi.createRancherResource('v3', 'users', {
        type: 'user',
        username: user.username,
        name: user.displayName,
        password,
        mustChangePassword: false,
        enabled: true,
      });

      user.id = resp.body.id;

      await setGlobalRoles(rancherApi, user, globalRoles);
    }

    test.beforeAll(async ({ rancherApi }) => {
      await createQaUser(rancherApi, users.owner, ['user-base', 'users-manage']);
      await createQaUser(rancherApi, users.plain, ['user-base']);
      await createQaUser(rancherApi, users.member, ['user-base']);

      await rancherApi.createRancherResource('v3', 'clusterroletemplatebindings', {
        clusterId: CLUSTER_ID,
        userId: users.owner.id,
        roleTemplateId: 'cluster-owner',
      });
      await rancherApi.createRancherResource('v3', 'clusterroletemplatebindings', {
        clusterId: CLUSTER_ID,
        userId: users.plain.id,
        roleTemplateId: 'cluster-owner',
      });
      await rancherApi.createRancherResource('v3', 'clusterroletemplatebindings', {
        clusterId: CLUSTER_ID,
        userId: users.member.id,
        roleTemplateId: 'cluster-member',
      });

      const project = await rancherApi.createProject(projectName, CLUSTER_ID);

      projectId = project.body.id;

      // Project role bindings are rejected until the project backing namespace exists
      await expect
        .poll(async () => (await rancherApi.getRancherResource('v3', 'projects', projectId)).body?.state, {
          timeout: 60_000,
        })
        .toBe('active');

      await rancherApi.createRancherResource('v3', 'projectroletemplatebindings', {
        projectId,
        userId: users.owner.id,
        roleTemplateId: 'project-owner',
      });
      await rancherApi.createRancherResource('v3', 'projectroletemplatebindings', {
        projectId,
        userId: users.member.id,
        roleTemplateId: 'project-member',
      });
    });

    /** Cleanup step that warns with context and lets the remaining steps run when it fails. */
    async function cleanupStep<T>(what: string, step: () => Promise<T>): Promise<T | undefined> {
      try {
        return await step();
      } catch (err) {
        console.warn(`[cluster-project-members-names cleanup] ${what}: ${(err as Error)?.message ?? err}`);

        return undefined;
      }
    }

    // Note: the shared users and project are created once (beforeAll) because every test reuses the same
    // 3 users + project and creating them per test is slow (Rule 3 priority 2); test bodies only read them.
    test.afterAll(async ({ rancherApi }) => {
      // Idempotent and safe after a partial beforeAll: only touches what was recorded or is found by name.
      // Lookups pass status 0 so a non-200 is not an assertion failure.
      if (!projectId) {
        const found = await cleanupStep('find project by name', () =>
          rancherApi.getRancherResource('v3', `projects?name=${projectName}&clusterId=${CLUSTER_ID}`, undefined, 0),
        );

        projectId = found?.body?.data?.[0]?.id || '';
      }

      if (projectId) {
        await cleanupStep(`delete project ${projectId}`, () =>
          rancherApi.deleteRancherResource('v3', 'projects', projectId, false),
        );
      }

      for (const user of Object.values(users)) {
        if (!user.id) {
          const found = await cleanupStep(`find user ${user.username}`, () =>
            rancherApi.getRancherResource('v3', `users?username=${user.username}`, undefined, 0),
          );

          user.id = found?.body?.data?.[0]?.id || '';
        }

        if (!user.id) {
          continue;
        }

        const bindings = await cleanupStep(`list cluster bindings of ${user.username}`, () =>
          rancherApi.getRancherResource('v3', `clusterroletemplatebindings?userId=${user.id}&limit=1000`, undefined, 0),
        );

        for (const binding of bindings?.body?.data || []) {
          await cleanupStep(`delete cluster binding ${binding.id}`, () =>
            rancherApi.deleteRancherResource('v3', 'clusterroletemplatebindings', binding.id, false),
          );
        }

        await cleanupStep(`delete user ${user.username}`, () =>
          rancherApi.deleteRancherResource('v3', 'users', user.id, false),
        );
      }
    });

    /** Log in (fresh context, see test.use above), land on the Members page and dismiss the welcome dialog. */
    async function openMembers(
      page: Page,
      login: (options?: { username?: string; password?: string }) => Promise<void>,
      membersPage: ClusterProjectMembersPo,
      credentials?: { username: string; password: string },
    ) {
      const welcome = new WelcomeDialogPo(page);

      await login(credentials);
      await welcome.dismissIfVisible();
      await membersPage.goTo();
      await welcome.dismissIfVisible();
    }

    // Revoke the session token of whoever logged in during the test, even when the test failed
    test.afterEach(async ({ page }) => {
      const loginPage = new LoginPagePo(page);

      await cleanupStep('logout', async () => {
        await loginPage.logout();
        await expect(loginPage.submitButton().self()).toBeVisible(LONG_TIMEOUT_OPT);
      });
    });

    async function expectResolvedUsers(membersPage: ClusterProjectMembersPo, panel: Locator, expected: QaUser[]) {
      for (const user of expected) {
        const row = membersPage.membershipRowWithText(panel, user.username);

        await expect(row).toHaveCount(1, LONG_TIMEOUT_OPT);

        const principal = membersPage.principalInRow(row);

        await expect(membersPage.principalName(principal)).toHaveText(resolvedLabel(user), LONG_TIMEOUT_OPT);
        await expect(membersPage.principalName(principal)).not.toHaveClass(/unresolved/);
        await expect(membersPage.principalDescription(principal)).toHaveText('Local');
        await expect(membersPage.principalAvatarImages(row)).toHaveCount(1);
      }

      // Every row is settled and none fell back to the raw principal id ("local u-xxxx")
      await expect(membersPage.unresolvedPrincipalNames(panel)).toHaveCount(0);
      await expect(membersPage.principalNames(panel).filter({ hasText: /local u-/ })).toHaveCount(0);
      await expect(membersPage.membershipRows(panel).filter({ hasText: /local u-/ })).toHaveCount(0);
      await expect(membersPage.membershipRows(panel).filter({ hasText: /Loading/i })).toHaveCount(0);
    }

    async function expectUnresolvedUsers(membersPage: ClusterProjectMembersPo, panel: Locator) {
      const unresolved = membersPage.unresolvedPrincipalNames(panel);

      await expect(unresolved.first()).toBeVisible(LONG_TIMEOUT_OPT);
      await expect(unresolved.filter({ hasText: /local u-/ }).first()).toBeVisible();
      await expect(membersPage.principalInfoIcon('local u-', panel)).toBeVisible();
    }

    test.describe('cluster owner with User-Base and users-manage', () => {
      test('S1: Cluster Membership shows resolved names when the principal lookup is forbidden (403)', async ({
        page,
        login,
      }) => {
        const membersPage = new ClusterProjectMembersPo(page, CLUSTER_ID, 'cluster-membership');

        const lookups = await membersPage.failPrincipalLookups('forbid');

        await openMembers(page, login, membersPage, { username: users.owner.username, password });

        await membersPage.clusterMembershipTab().click();
        await expectResolvedUsers(membersPage, membersPage.clusterMembershipPanel(), [
          users.owner,
          users.plain,
          users.member,
        ]);
        await expect
          .poll(() => lookups.hits(), { message: 'forced 403 hit the by-id principal lookups' })
          .toBeGreaterThan(0);
      });

      test('S2: Project Membership shows resolved names when the principal lookup is forbidden (403)', async ({
        page,
        login,
      }) => {
        const membersPage = new ClusterProjectMembersPo(page, CLUSTER_ID, 'project-membership');

        const lookups = await membersPage.failPrincipalLookups('forbid');

        await openMembers(page, login, membersPage, { username: users.owner.username, password });
        await membersPage.projectMembershipTab().click();

        await expectResolvedUsers(membersPage, membersPage.projectMembershipPanel(), [users.owner, users.member]);
        await expect
          .poll(() => lookups.hits(), { message: 'forced 403 hit the by-id principal lookups' })
          .toBeGreaterThan(0);
      });

      test('S1b: Cluster and Project Membership show resolved names when the lookup request is aborted', async ({
        page,
        login,
      }) => {
        const membersPage = new ClusterProjectMembersPo(page, CLUSTER_ID, 'cluster-membership');

        const lookups = await membersPage.failPrincipalLookups('abort');

        await openMembers(page, login, membersPage, { username: users.owner.username, password });
        await membersPage.clusterMembershipTab().click();
        await expectResolvedUsers(membersPage, membersPage.clusterMembershipPanel(), [
          users.owner,
          users.plain,
          users.member,
        ]);

        await membersPage.projectMembershipTab().click();
        await expectResolvedUsers(membersPage, membersPage.projectMembershipPanel(), [users.owner, users.member]);
        await expect.poll(() => lookups.hits(), { message: 'aborted the by-id principal lookups' }).toBeGreaterThan(0);
      });
    });

    test.describe('control and boundaries', () => {
      test('S3: admin sees resolved names without any forced failure', async ({ page, login }) => {
        const membersPage = new ClusterProjectMembersPo(page, CLUSTER_ID, 'cluster-membership');

        await openMembers(page, login, membersPage);
        await membersPage.clusterMembershipTab().click();
        await expect(membersPage.clusterMembershipPanel()).toBeVisible();
        await expectResolvedUsers(membersPage, membersPage.clusterMembershipPanel(), [
          users.owner,
          users.plain,
          users.member,
        ]);

        await membersPage.projectMembershipTab().click();
        await expectResolvedUsers(membersPage, membersPage.projectMembershipPanel(), [users.owner, users.member]);
      });

      test('S4: cluster owner without users-manage still sees resolved names when the lookup is forbidden', async ({
        page,
        login,
      }) => {
        const membersPage = new ClusterProjectMembersPo(page, CLUSTER_ID, 'cluster-membership');

        const lookups = await membersPage.failPrincipalLookups('forbid');

        await openMembers(page, login, membersPage, { username: users.plain.username, password });
        await membersPage.clusterMembershipTab().click();
        await expectResolvedUsers(membersPage, membersPage.clusterMembershipPanel(), [
          users.owner,
          users.plain,
          users.member,
        ]);

        await membersPage.projectMembershipTab().click();
        await expectResolvedUsers(membersPage, membersPage.projectMembershipPanel(), [users.owner, users.member]);
        await expect
          .poll(() => lookups.hits(), { message: 'forced 403 hit the by-id principal lookups' })
          .toBeGreaterThan(0);
      });

      test('S5: cluster member (cannot list users) keeps the raw ids and rows are not blank when the lookup is forbidden', async ({
        page,
        login,
      }) => {
        const membersPage = new ClusterProjectMembersPo(page, CLUSTER_ID, 'cluster-membership');
        const lookups = await membersPage.failPrincipalLookups('forbid');

        await openMembers(page, login, membersPage, { username: users.member.username, password });
        await membersPage.clusterMembershipTab().click();

        const panel = membersPage.clusterMembershipPanel();

        await expectUnresolvedUsers(membersPage, panel);

        // No row is blank: every principal cell still renders some text
        const names = membersPage.principalNames(panel);

        await expect(names.first()).toBeVisible();
        await expect(names.filter({ hasNotText: /\S/ })).toHaveCount(0);

        await expect
          .poll(() => lookups.hits(), { message: 'forced 403 hit the by-id principal lookups' })
          .toBeGreaterThan(0);

        // The page stays usable: the other tab still renders its rows
        await membersPage.projectMembershipTab().click();
        await expect(membersPage.membershipRows(membersPage.projectMembershipPanel()).first()).toBeVisible();
        await expect(membersPage.principalNames(membersPage.projectMembershipPanel()).first()).not.toHaveText('');
      });
    });
  },
);
