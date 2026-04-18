import { test, expect } from '@/support/fixtures';
import {
  FleetWorkspaceListPagePo,
  FleetWorkspaceCreateEditPo,
} from '@/e2e/po/pages/fleet/fleet.cattle.io.fleetworkspace.po';
import { HeaderPo } from '@/e2e/po/components/header.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';

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
  });

  test.describe('CRUD', () => {
    test('can create a fleet workspace', async ({ page, login, rancherApi }) => {
      await login();
      const customWorkspace = rancherApi.createE2EResourceName('fleet-workspace');
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

        await createPage.resourceDetail().createEditView().create();
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
        const listPage = new FleetWorkspaceListPagePo(page);
        const headerPo = new HeaderPo(page);

        await listPage.goTo();
        await listPage.waitForPage();
        await listPage.list().resourceTable().sortableTable().noRowsShouldNotExist();
        await headerPo.selectWorkspace(wsName);
        await headerPo.checkCurrentWorkspace(wsName);
      } finally {
        await rancherApi.deleteRancherResource('v3', 'fleetWorkspaces', wsName, false);
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
    });
  });
});
