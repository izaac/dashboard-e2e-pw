import { test, expect } from '@/support/fixtures';
import RolesPo from '@/e2e/po/pages/users-and-auth/roles.po';
import UsersPo from '@/e2e/po/pages/users-and-auth/users.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import { HeaderPo } from '@/e2e/po/components/header.po';
import * as jsyaml from 'js-yaml';

const globalRoleYaml = `apiVersion: management.cattle.io/v3
kind: GlobalRole
displayName: test-global-role-yaml
description: Base user + Read-only on all downstream clusters
metadata:
  name: test-global-role-yaml
inheritedClusterRoles:
  - projects-view
rules:
- apiGroups:
  - management.cattle.io
  resources:
  - preferences
  verbs:
  - '*'
- apiGroups:
  - management.cattle.io
  resources:
  - settings
  verbs:
  - get
  - list
  - watch
- apiGroups:
  - management.cattle.io
  resources:
  - features
  verbs:
  - get
  - list
  - watch
- apiGroups:
  - project.cattle.io
  resources:
  - sourcecodecredentials
  verbs:
  - '*'
- apiGroups:
  - project.cattle.io
  resources:
  - sourcecoderepositories
  verbs:
  - '*'
- apiGroups:
  - management.cattle.io
  resources:
  - rancherusernotifications
  verbs:
  - get
  - list
  - watch
`;

test.describe('Roles Templates', { tag: ['@usersAndAuths', '@adminUser'] }, () => {
  test.describe.configure({ mode: 'serial' });

  test.describe('Roles', () => {
    test('can create a Global Role template', async ({ page, login, rancherApi }) => {
      await login();

      const runTimestamp = Date.now();
      const runPrefix = `e2e-test-${runTimestamp}`;
      const globalRoleName = `${runPrefix}-my-global-role`;
      const roles = new RolesPo(page);
      const sideNav = new ProductNavPo(page);
      const fragment = 'GLOBAL';

      await roles.goTo(undefined, fragment);
      await roles.waitForPage(undefined, fragment);

      const burgerMenu = new BurgerMenuPo(page);

      await burgerMenu.checkIfMenuItemLinkIsHighlighted('Users & Authentication');
      await burgerMenu.checkIfClusterMenuLinkIsHighlighted('local', false);

      await roles.listCreate('Create Global Role');

      const createGlobalRole = roles.createGlobal();

      await createGlobalRole.waitForPage('roleContext=GLOBAL', 'grant-resources');
      await createGlobalRole.name().set(globalRoleName);
      await createGlobalRole.description().set('e2e-description');
      await createGlobalRole.selectCreatorDefaultRadioBtn(0);
      await createGlobalRole.selectVerbs(0, 3);
      await createGlobalRole.selectVerbs(0, 4);
      await createGlobalRole.selectResourcesByLabelValue(0, 'GlobalRoles');

      const resp = await createGlobalRole.saveAndWaitForRequests('POST', '/v3/globalroles');
      const respBody = await resp.json();
      const globalRoleId = respBody.id;

      try {
        // View role details
        await roles.waitForPage(undefined, fragment);

        // Confirm created role is not built-in
        await roles.list('GLOBAL').checkBuiltIn(globalRoleName, false);

        await roles.list('GLOBAL').details(globalRoleName, 2).locator('a').click();

        const globalRoleDetails = roles.detailGlobal(globalRoleId);

        await globalRoleDetails.waitForPage();
        await expect(globalRoleDetails.mastheadTitle()).toContainText(globalRoleName);

        await sideNav.navToSideMenuEntryByLabel('Role Templates');
        await roles.waitForPage(undefined, fragment);

        // Confirm role is marked as default
        await roles.list('GLOBAL').checkDefault(globalRoleName, true);

        const usersPo = new UsersPo(page);

        await usersPo.goTo();
        const usersListPo = usersPo.list();

        await usersListPo.masthead().create();

        const userCreate = usersPo.createEdit();

        await userCreate.waitForPage();
        const roleCheckbox = page.locator(`.global-permissions [data-testid="grb-checkbox-${globalRoleId}"]`);

        await expect(roleCheckbox).toBeVisible();

        await sideNav.navToSideMenuEntryByLabel('Role Templates');

        // Edit YAML to set builtin: false
        await roles.goToEditYamlPage(globalRoleName);

        const yamlValue = await createGlobalRole.yamlEditor().value();
        const json: any = jsyaml.load(yamlValue);

        json.builtin = false;
        await createGlobalRole.yamlEditor().set(jsyaml.dump(json));
        await createGlobalRole.saveEditYamlForm().click();

        await roles.waitForPage();

        // Confirm not flagged as built-in after YAML edit
        await expect(roles.list('GLOBAL').details(globalRoleName, 4)).not.toContainText('icon-checkmark');
      } finally {
        // Cleanup
        await rancherApi.deleteRancherResource('v3', 'globalRoles', globalRoleId, false);
      }
    });

    test('can create a Cluster Role template', async ({ page, login, rancherApi }) => {
      await login();

      const runTimestamp = Date.now();
      const runPrefix = `e2e-test-${runTimestamp}`;
      const clusterRoleName = `${runPrefix}-my-cluster-role`;
      const roles = new RolesPo(page);
      const fragment = 'CLUSTER';
      let roleId: string | undefined;

      try {
        await roles.goTo(undefined, fragment);
        await roles.waitForPage(undefined, fragment);
        await roles.listCreate('Create Cluster Role');

        const createClusterRole = roles.createRole();

        await createClusterRole.waitForPage('roleContext=CLUSTER', 'grant-resources');
        await createClusterRole.name().set(clusterRoleName);
        await createClusterRole.description().set('e2e-create-cluster-role');
        await createClusterRole.selectCreatorDefaultRadioBtn(0);
        await createClusterRole.selectLockedRadioBtn(0);
        await createClusterRole.selectVerbs(0, 3);
        await createClusterRole.selectVerbs(0, 4);
        await createClusterRole.selectResourcesByLabelValue(0, 'ClusterRoles');

        const resp = await createClusterRole.saveAndWaitForRequests('POST', '/v3/roletemplates');
        const respBody = await resp.json();

        roleId = respBody.id;

        // View role details
        await roles.waitForPage(undefined, fragment);
        await roles.list('CLUSTER').resourceTable().sortableTable().filter(clusterRoleName);
        await roles.waitForPage(undefined, fragment);
        await roles.list('CLUSTER').resourceTable().sortableTable().checkRowCount(false, 1);
        await roles.list('CLUSTER').checkDefault(clusterRoleName, true);
        await roles.list('CLUSTER').details(clusterRoleName, 2).locator('a').click();

        const clusterRoleDetails = roles.detailRole(roleId);

        await clusterRoleDetails.waitForPage();
        await expect(page.locator('body')).toContainText(`Cluster - ${clusterRoleName}`);
      } finally {
        if (roleId) {
          await rancherApi.deleteRancherResource('v3', 'roleTemplates', roleId, false);
        }
      }
    });

    test('can create a Project/Namespaces Role template', async ({ page, login, rancherApi }) => {
      await login();

      const runTimestamp = Date.now();
      const runPrefix = `e2e-test-${runTimestamp}`;
      const projectRoleName = `${runPrefix}-my-project-role`;
      const roles = new RolesPo(page);
      const fragment = 'NAMESPACE';
      let roleId: string | undefined;

      try {
        await roles.goTo(undefined, fragment);
        await roles.waitForPage(undefined, fragment);
        await roles.listCreate('Create Project/Namespaces Role');

        const createProjectRole = roles.createRole();

        await createProjectRole.waitForPage('roleContext=NAMESPACE', 'grant-resources');
        await createProjectRole.name().set(projectRoleName);
        await createProjectRole.description().set('e2e-description');
        await createProjectRole.selectCreatorDefaultRadioBtn(0);
        await createProjectRole.selectLockedRadioBtn(0);
        await createProjectRole.selectVerbs(0, 3);
        await createProjectRole.selectVerbs(0, 4);
        await createProjectRole.selectResourcesByLabelValue(0, 'Namespaces');

        const resp = await createProjectRole.saveAndWaitForRequests('POST', '/v3/roletemplates');
        const respBody = await resp.json();

        roleId = respBody.id;

        // View role details
        await roles.waitForPage(undefined, fragment);
        await roles.list('NAMESPACE').resourceTable().sortableTable().filter(projectRoleName);
        await roles.waitForPage(undefined, fragment);
        await roles.list('NAMESPACE').resourceTable().sortableTable().checkRowCount(false, 1);
        await roles.list('NAMESPACE').checkDefault(projectRoleName, true);
        await roles.list('NAMESPACE').details(projectRoleName, 2).locator('a').click();

        const projectRoleDetails = roles.detailRole(roleId);

        await projectRoleDetails.waitForPage();
        await expect(page.locator('body')).toContainText(`Project/Namespaces - ${projectRoleName}`);
      } finally {
        if (roleId) {
          await rancherApi.deleteRancherResource('v3', 'roleTemplates', roleId, false);
        }
      }
    });

    test('shows warning message when deleting the Administrator role', async ({ page, login }) => {
      await login();

      const roles = new RolesPo(page);
      const fragment = 'GLOBAL';
      const globalAdminRoleName = 'Administrator';

      await roles.goTo(undefined, fragment);
      await roles.waitForPage(undefined, fragment);

      await roles.list('GLOBAL').elementWithName(globalAdminRoleName).click();
      await roles.list('GLOBAL').delete().click();

      const promptRemove = new PromptRemove(page);

      await expect(promptRemove.warning()).toBeVisible();
      await expect(promptRemove.warning().first()).toContainText('Caution:');
    });

    test('can delete a role template from the detail page', async ({ page, login, rancherApi }) => {
      await login();

      const runTimestamp = Date.now();
      const roleName = `e2e-test-${runTimestamp}-delete-detail`;

      const createResp = await rancherApi.createRancherResource('v3', 'roletemplates', {
        context: 'cluster',
        name: roleName,
        rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get', 'list'] }],
      });
      const roleId = createResp.body.id;

      const roles = new RolesPo(page);
      const detailPage = roles.detailRole(roleId);

      await detailPage.goTo();
      await detailPage.waitForPage();

      const actionMenu = await detailPage.detail().openMastheadActionMenu();

      await actionMenu.clickMenuItem(5);

      const promptRemove = new PromptRemove(page);

      await promptRemove.remove();

      await roles.waitForPage();
      await expect(roles.list('CLUSTER').elementWithName(roleId)).not.toBeAttached();
    });

    test('can delete a global role template', async ({ page, login, rancherApi }) => {
      await login();

      const runTimestamp = Date.now();
      const globalRoleName = `e2e-test-${runTimestamp}-delete-global`;

      await rancherApi.createRancherResource('v3', 'globalRoles', {
        name: globalRoleName,
        displayName: globalRoleName,
        rules: [{ apiGroups: ['management.cattle.io'], resources: ['preferences'], verbs: ['get'] }],
      });

      const roles = new RolesPo(page);

      await roles.goTo(undefined, 'GLOBAL');
      await roles.waitForPage(undefined, 'GLOBAL');

      await roles.list('GLOBAL').elementWithName(globalRoleName).click();
      await roles.list('GLOBAL').delete().click();

      const promptRemove = new PromptRemove(page);

      const deleteResponse = page.waitForResponse(
        (resp) => resp.url().includes('/v3/globalRoles/') && resp.request().method() === 'DELETE',
        { timeout: 10000 },
      );

      await promptRemove.remove();

      const resp = await deleteResponse;

      expect(resp.status()).toBeLessThan(300);
      await expect(roles.list('GLOBAL').elementWithName(globalRoleName)).not.toBeAttached();
    });

    test('Cloning a Global Role with inheritedClusterRoles should pass the property correctly', async ({
      page,
      login,
      rancherApi,
    }) => {
      await login();

      const globalRoleNameYaml = 'test-global-role-yaml';
      const clonedRoleName = `cloned-global-role-${Date.now()}`;

      // Import YAML via cluster dashboard
      const clusterDashboard = new ClusterDashboardPagePo(page, 'local');
      const header = new HeaderPo(page);

      await clusterDashboard.goTo();
      await clusterDashboard.waitForPage();

      await header.importYamlHeaderAction().click();
      await header.importYaml().importYamlEditor().set(globalRoleYaml);
      await header.importYaml().importYamlImportClick();
      await header.importYaml().importYamlSuccessTitleCheck();
      await header.importYaml().importYamlCloseClick();

      try {
        // Clone role
        const roles = new RolesPo(page);

        await roles.goTo(undefined, 'GLOBAL');
        await roles.waitForPage(undefined, 'GLOBAL');
        await roles.list('GLOBAL').elementWithName(globalRoleNameYaml).click();
        await roles.list('GLOBAL').rowCloneYamlClick(globalRoleNameYaml);

        const cloneResponse = page.waitForResponse(
          (resp) => resp.url().includes('/v3/globalroles') && resp.request().method() === 'POST',
          { timeout: 15000 },
        );

        const editGlobalRole = roles.createRole();

        await editGlobalRole.name().set(clonedRoleName);
        await editGlobalRole.saveCreateForm().click();

        const resp = await cloneResponse;
        const body = await resp.json();

        expect(resp.status()).toBe(201);
        expect(body.inheritedClusterRoles).toContain('projects-view');
      } finally {
        // Cleanup both the original and cloned roles
        await rancherApi.deleteRancherResource('v3', 'globalRoles', globalRoleNameYaml, false);
        // Attempt to clean up cloned role by listing and finding it
        try {
          const allRoles = await rancherApi.getRancherResource('v3', 'globalRoles');
          const clonedRole = allRoles.body.data?.find(
            (r: any) => r.displayName === clonedRoleName || r.name === clonedRoleName,
          );

          if (clonedRole) {
            await rancherApi.deleteRancherResource('v3', 'globalRoles', clonedRole.id, false);
          }
        } catch {
          // best effort cleanup
        }
      }
    });

    test('can update a Global Role via YAML editor', async ({ page, login, rancherApi }) => {
      await login();

      const roleName = `e2e-test-${Date.now()}-update-global`;

      const createResp = await rancherApi.createRancherResource('v3', 'globalRoles', {
        name: roleName,
        displayName: roleName,
        rules: [{ apiGroups: ['management.cattle.io'], resources: ['preferences'], verbs: ['get'] }],
      });
      const roleId = createResp.body.id;

      try {
        const roles = new RolesPo(page);

        await roles.goTo(undefined, 'GLOBAL');
        await roles.waitForPage(undefined, 'GLOBAL');

        await roles.goToEditYamlPage(roleName);

        const editRole = roles.createGlobal(roleId);
        const yamlValue = await editRole.yamlEditor().value();
        const json: any = jsyaml.load(yamlValue);

        json.description = 'updated-description';
        await editRole.yamlEditor().set(jsyaml.dump(json));

        const saveResp = page.waitForResponse(
          (resp) => resp.url().includes('/v1/management.cattle.io.globalroles/') && resp.request().method() === 'PUT',
          { timeout: 15000 },
        );

        await editRole.saveEditYamlForm().click();

        const resp = await saveResp;

        expect(resp.status()).toBe(200);

        const body = await resp.json();

        expect(body.description).toBe('updated-description');
      } finally {
        await rancherApi.deleteRancherResource('v3', 'globalRoles', roleId, false);
      }
    });

    test('can import a Global Role via YAML', async ({ page, login, rancherApi }) => {
      await login();

      const importRoleName = `e2e-import-global-${Date.now()}`;
      const importYaml = `apiVersion: management.cattle.io/v3
kind: GlobalRole
displayName: ${importRoleName}
metadata:
  name: ${importRoleName}
rules:
- apiGroups:
  - management.cattle.io
  resources:
  - preferences
  verbs:
  - get
  - list
  - watch
`;

      const clusterDashboard = new ClusterDashboardPagePo(page, 'local');
      const header = new HeaderPo(page);

      await clusterDashboard.goTo();
      await clusterDashboard.waitForPage();

      await header.importYamlHeaderAction().click();
      await header.importYaml().importYamlEditor().set(importYaml);
      await header.importYaml().importYamlImportClick();
      await header.importYaml().importYamlSuccessTitleCheck();
      await header.importYaml().importYamlCloseClick();

      try {
        const roles = new RolesPo(page);

        await roles.goTo(undefined, 'GLOBAL');
        await roles.waitForPage(undefined, 'GLOBAL');

        await expect(roles.list('GLOBAL').elementWithName(importRoleName)).toBeAttached();
      } finally {
        await rancherApi.deleteRancherResource('v3', 'globalRoles', importRoleName, false);
      }
    });

    test('can import a Cluster Role Template via YAML', async ({ page, login, rancherApi }) => {
      await login();

      const importRoleName = `e2e-import-cluster-${Date.now()}`;
      const importYaml = `apiVersion: management.cattle.io/v3
kind: RoleTemplate
displayName: ${importRoleName}
context: cluster
metadata:
  name: ${importRoleName}
rules:
- apiGroups:
  - ""
  resources:
  - pods
  verbs:
  - get
  - list
`;

      const clusterDashboard = new ClusterDashboardPagePo(page, 'local');
      const header = new HeaderPo(page);

      await clusterDashboard.goTo();
      await clusterDashboard.waitForPage();

      await header.importYamlHeaderAction().click();
      await header.importYaml().importYamlEditor().set(importYaml);
      await header.importYaml().importYamlImportClick();
      await header.importYaml().importYamlSuccessTitleCheck();
      await header.importYaml().importYamlCloseClick();

      try {
        const roles = new RolesPo(page);

        await roles.goTo(undefined, 'CLUSTER');
        await roles.waitForPage(undefined, 'CLUSTER');

        await roles.list('CLUSTER').resourceTable().sortableTable().filter(importRoleName);
        await expect(roles.list('CLUSTER').elementWithName(importRoleName)).toBeAttached();
      } finally {
        await rancherApi.deleteRancherResource('v3', 'roleTemplates', importRoleName, false);
      }
    });

    test('can delete a Cluster Role template from the list', async ({ page, login, rancherApi }) => {
      await login();

      const roleName = `e2e-test-${Date.now()}-delete-cluster`;

      await rancherApi.createRancherResource('v3', 'roletemplates', {
        context: 'cluster',
        name: roleName,
        rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get', 'list'] }],
      });

      const roles = new RolesPo(page);

      await roles.goTo(undefined, 'CLUSTER');
      await roles.waitForPage(undefined, 'CLUSTER');

      await roles.list('CLUSTER').resourceTable().sortableTable().filter(roleName);

      const actionMenu = await roles.list('CLUSTER').actionMenu(roleName);

      await actionMenu.getMenuItem('Delete').click();

      const promptRemove = new PromptRemove(page);

      const deleteResponse = page.waitForResponse(
        (resp) => resp.url().includes('/v3/roleTemplates/') && resp.request().method() === 'DELETE',
        { timeout: 10000 },
      );

      await promptRemove.remove();

      const resp = await deleteResponse;

      expect(resp.status()).toBeLessThan(300);
      await expect(roles.list('CLUSTER').elementWithName(roleName)).not.toBeAttached();
    });

    test('can create a Cluster Role via form', async ({ page, login, rancherApi }) => {
      await login();

      const clusterRoleName = `e2e-test-${Date.now()}-form-cluster`;
      const roles = new RolesPo(page);
      const fragment = 'CLUSTER';
      let roleId: string | undefined;

      try {
        await roles.goTo(undefined, fragment);
        await roles.waitForPage(undefined, fragment);
        await roles.listCreate('Create Cluster Role');

        const createClusterRole = roles.createRole();

        await createClusterRole.waitForPage('roleContext=CLUSTER', 'grant-resources');
        await createClusterRole.name().set(clusterRoleName);
        await createClusterRole.description().set('e2e-form-cluster-role');
        await createClusterRole.selectVerbs(0, 3);
        await createClusterRole.selectVerbs(0, 4);
        await createClusterRole.selectResourcesByLabelValue(0, 'ClusterRoles');

        const resp = await createClusterRole.saveAndWaitForRequests('POST', '/v3/roletemplates');
        const respBody = await resp.json();

        roleId = respBody.id;

        await roles.waitForPage(undefined, fragment);
        await roles.list('CLUSTER').resourceTable().sortableTable().filter(clusterRoleName);
        await roles.list('CLUSTER').resourceTable().sortableTable().checkRowCount(false, 1);
      } finally {
        if (roleId) {
          await rancherApi.deleteRancherResource('v3', 'roleTemplates', roleId, false);
        }
      }
    });

    test('can Download YAML for a Global Role', async ({ page, login, rancherApi }) => {
      await login();

      const roleName = `e2e-test-${Date.now()}-dl-yaml`;

      const resp = await rancherApi.createRancherResource('v3', 'globalRoles', {
        name: roleName,
        rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get', 'list'] }],
      });

      try {
        const roles = new RolesPo(page);

        await roles.goTo(undefined, 'GLOBAL');
        await roles.waitForPage(undefined, 'GLOBAL');

        await roles.list('GLOBAL').resourceTable().sortableTable().filter(roleName);
        await roles.list('GLOBAL').elementWithName(roleName).click();

        const [download] = await Promise.all([
          page.waitForEvent('download'),
          roles.list('GLOBAL').downloadYaml().click(),
        ]);

        expect(download.suggestedFilename()).toContain(roleName);
      } finally {
        await rancherApi.deleteRancherResource('v3', 'globalRoles', resp.body.id, false);
      }
    });

    test('can Download YAML for a Cluster Role', async ({ page, login, rancherApi }) => {
      await login();

      const roleName = `e2e-test-${Date.now()}-dl-cluster-yaml`;

      const resp = await rancherApi.createRancherResource('v3', 'roletemplates', {
        context: 'cluster',
        name: roleName,
        rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get', 'list'] }],
      });

      try {
        const roles = new RolesPo(page);

        await roles.goTo(undefined, 'CLUSTER');
        await roles.waitForPage(undefined, 'CLUSTER');

        await roles.list('CLUSTER').resourceTable().sortableTable().filter(roleName);
        await roles.list('CLUSTER').elementWithName(roleName).click();

        const [download] = await Promise.all([
          page.waitForEvent('download'),
          roles.list('CLUSTER').downloadYaml().click(),
        ]);

        expect(download.suggestedFilename()).toContain(roleName);
      } finally {
        await rancherApi.deleteRancherResource('v3', 'roleTemplates', roleName, false);
      }
    });
  });
});
