import { test, expect } from '@/support/fixtures';
import {
  FleetWorkspaceListPagePo,
  FleetWorkspaceCreateEditPo,
} from '@/e2e/po/pages/fleet/fleet.cattle.io.fleetworkspace.po';
import { FleetApplicationListPagePo } from '@/e2e/po/pages/fleet/fleet.cattle.io.application.po';
import { HeaderPo } from '@/e2e/po/components/header.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import { fleetWorkspacesSmallResponse } from '@/e2e/blueprints/fleet/workspaces-get';

test.describe('Workspaces', { tag: ['@fleet', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@noVai'] }, () => {
    test('check table headers are available in list view', async ({ page, login }) => {
      await login();
      const listPage = new FleetWorkspaceListPagePo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      await listPage.list().resourceTable().sortableTable().rowWithName('fleet-default').checkVisible();
      await listPage.list().resourceTable().sortableTable().noRowsShouldNotExist();

      const expectedHeaders = ['State', 'Name', 'Git Repos', 'Helm Ops', 'Clusters', 'Cluster Groups', 'Age'];
      const actualHeaders = await listPage.list().resourceTable().sortableTable().headerNames();

      expect(actualHeaders).toEqual(expectedHeaders);
    });

    test('pagination is visible and user is able to navigate through workspace data', async ({
      page,
      login,
      rancherApi,
    }) => {
      test.skip(true, 'Requires creating 26+ workspaces — expensive setup');
    });

    test('filter workspace', async ({ page, login, rancherApi }) => {
      test.skip(true, 'Requires creating multiple workspaces — expensive setup');
    });

    test('sorting changes the order of paginated workspace data', async ({ page, login, rancherApi }) => {
      test.skip(true, 'Requires creating 26+ workspaces — expensive setup');
    });

    test('pagination is hidden', async ({ page, login }) => {
      await page.route('**/v1/management.cattle.io.fleetworkspaces?**', (route) => {
        route.fulfill({ json: fleetWorkspacesSmallResponse() });
      });

      await login();
      const listPage = new FleetWorkspaceListPagePo(page);

      await listPage.goTo();
      await listPage.waitForPage();

      const table = listPage.list().resourceTable().sortableTable();

      await table.checkVisible();
      await table.checkLoadingIndicatorNotVisible();
      await table.checkRowCount(false, 2);
      await expect(table.pagination()).toBeHidden();
    });
  });

  test.describe('CRUD', () => {
    test('can create a fleet workspace', async ({ page, login, rancherApi }) => {
      await login();
      const customWorkspace = rancherApi.createE2EResourceName('fleet-ws-create');
      const listPage = new FleetWorkspaceListPagePo(page);
      const createPage = new FleetWorkspaceCreateEditPo(page);

      try {
        await listPage.goTo();
        await listPage.waitForPage();
        await expect(listPage.baseResourceList().masthead().title()).toContainText('Workspaces');
        await listPage.list().resourceTable().sortableTable().noRowsShouldNotExist();
        await listPage.baseResourceList().masthead().create();
        await createPage.waitForPage(undefined, 'allowedtargetnamespaces');
        await expect(createPage.mastheadTitle()).toContainText('Workspace: Create');

        await createPage.resourceDetail().createEditView().nameNsDescription().name().set(customWorkspace);
        await createPage
          .resourceDetail()
          .createEditView()
          .nameNsDescription()
          .description()
          .set(`${customWorkspace}-desc`);

        const responsePromise = page.waitForResponse(
          (resp) => resp.url().includes('/v3/fleetworkspaces') && resp.request().method() === 'POST',
        );

        await createPage.resourceDetail().createEditView().createButton().click();
        const resp = await responsePromise;

        expect(resp.status()).toBe(201);
        await listPage.waitForPage();
        await listPage.list().resourceTable().sortableTable().rowWithName(customWorkspace).checkVisible();
      } finally {
        await rancherApi.deleteRancherResource('v3', 'fleetWorkspaces', customWorkspace, false);
      }
    });

    test('user sees custom workspace as an option in workspace selector', async ({ page, login, rancherApi }) => {
      const wsName = rancherApi.createE2EResourceName('fleet-ws-vis');

      await rancherApi.createRancherResource('v3', 'fleetworkspaces', {
        metadata: { name: wsName },
        name: wsName,
      });

      try {
        await login();
        // Navigate to Fleet application page where workspace switcher is visible
        // (the workspace LIST page hides the switcher via showWorkspaceSwitcher(false))
        const appListPage = new FleetApplicationListPagePo(page);
        const headerPo = new HeaderPo(page);

        await appListPage.goTo();
        await appListPage.waitForPage();
        await headerPo.selectWorkspace(wsName);
        await headerPo.checkCurrentWorkspace(wsName);
      } finally {
        await rancherApi.deleteRancherResource('v3', 'fleetWorkspaces', wsName, false);
      }
    });

    test('can Edit Config', async ({ page, login, rancherApi }) => {
      const customWorkspace = rancherApi.createE2EResourceName('fleet-ws-edit');
      const ociSecretName = rancherApi.createE2EResourceName('oci-secret');

      await rancherApi.createRancherResource('v3', 'fleetworkspaces', {
        metadata: { name: customWorkspace },
        name: customWorkspace,
      });

      await rancherApi.createRancherResource('v1', 'secrets', {
        metadata: { name: ociSecretName, namespace: customWorkspace },
        type: 'fleet.cattle.io/bundle-oci-storage/v1alpha1',
        apiVersion: 'v1',
        kind: 'Secret',
        data: {
          agentPassword: 'Zm9v',
          agentUsername: 'ZmxlZXQtY2k=',
          basicHTTP: 'ZmFsc2U=',
          insecure: 'dHJ1ZQ==',
          password: 'Zm9v',
          reference: '',
          username: 'ZmxlZXQtY2k=',
        },
      });

      try {
        await login();
        const listPage = new FleetWorkspaceListPagePo(page);
        const editPage = new FleetWorkspaceCreateEditPo(page, customWorkspace);

        await listPage.goTo();
        await listPage.waitForPage();
        await listPage.list().resourceTable().sortableTable().noRowsShouldNotExist();

        const actionMenu = await listPage.list().actionMenu(customWorkspace);

        await actionMenu.getMenuItem('Edit Config').click();
        await editPage.waitForPage('mode=edit', 'allowedtargetnamespaces');
        await expect(editPage.mastheadTitle()).toContainText(`Workspace: ${customWorkspace}`);

        const editView = editPage.resourceDetail().createEditView();

        await editView.nameNsDescription().description().set(`${customWorkspace}-desc-edit`);

        await editPage.resourceDetail().tabs().tab('ociRegistries').click();

        await editPage.defaultOciRegistry().dropdown().click();
        await editPage.defaultOciRegistry().optionByLabel(ociSecretName).click();

        const responsePromise = page.waitForResponse(
          (resp) => resp.url().includes(`/v3/fleetWorkspaces/${customWorkspace}`) && resp.request().method() === 'PUT',
        );

        await editPage.resourceDetail().cruResource().saveOrCreate().click();
        const resp = await responsePromise;

        expect(resp.status()).toBe(200);
        const body = await resp.json();

        expect(body.id).toEqual(customWorkspace);
        expect(body.annotations['field.cattle.io/description']).toEqual(`${customWorkspace}-desc-edit`);
        expect(body.annotations['ui-default-oci-registry']).toEqual(ociSecretName);
        await listPage.waitForPage();
      } finally {
        await rancherApi.deleteRancherResource('v1', `secrets/${customWorkspace}`, ociSecretName, false);
        await rancherApi.deleteRancherResource('v3', 'fleetWorkspaces', customWorkspace, false);
      }
    });

    test('can Download YAML', async ({ page, login, rancherApi }) => {
      const customWorkspace = rancherApi.createE2EResourceName('fleet-ws-dl');

      await rancherApi.createRancherResource('v3', 'fleetworkspaces', {
        metadata: { name: customWorkspace },
        name: customWorkspace,
      });

      try {
        await login();
        const listPage = new FleetWorkspaceListPagePo(page);

        await listPage.goTo();
        await listPage.waitForPage();
        await listPage.list().resourceTable().sortableTable().noRowsShouldNotExist();

        const actionMenu = await listPage.list().actionMenu(customWorkspace);

        const [download] = await Promise.all([
          page.waitForEvent('download'),
          actionMenu.getMenuItem('Download YAML').click(),
        ]);

        expect(download.suggestedFilename()).toBe(`${customWorkspace}.yaml`);
      } finally {
        await rancherApi.deleteRancherResource('v3', 'fleetWorkspaces', customWorkspace, false);
      }
    });

    test('can delete workspace', async ({ page, login, rancherApi }) => {
      const deleteName = rancherApi.createE2EResourceName('fleet-ws-del');

      await rancherApi.createRancherResource('v3', 'fleetworkspaces', {
        metadata: { name: deleteName },
        name: deleteName,
      });

      await login();
      const listPage = new FleetWorkspaceListPagePo(page);

      try {
        await listPage.goTo();
        await listPage.waitForPage();
        await listPage.list().resourceTable().sortableTable().noRowsShouldNotExist();

        const actionMenu = await listPage.list().actionMenu(deleteName);

        await actionMenu.getMenuItem('Delete').click();

        const responsePromise = page.waitForResponse(
          (resp) => resp.url().includes(`/v3/fleetWorkspaces/${deleteName}`) && resp.request().method() === 'DELETE',
        );

        const prompt = new PromptRemove(page);

        await prompt.confirmField().set(deleteName);
        await prompt.remove();
        await responsePromise;
        await listPage.waitForPage();

        await expect(listPage.list().resourceTable().sortableTable().rowElementWithName(deleteName)).not.toBeAttached();
      } finally {
        await rancherApi.deleteRancherResource('v3', 'fleetWorkspaces', deleteName, false);
      }
    });
  });
});
