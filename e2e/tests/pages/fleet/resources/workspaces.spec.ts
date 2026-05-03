import { test, expect } from '@/support/fixtures';
import {
  FleetWorkspaceListPagePo,
  FleetWorkspaceCreateEditPo,
} from '@/e2e/po/pages/fleet/fleet.cattle.io.fleetworkspace.po';
import { FleetApplicationListPagePo } from '@/e2e/po/pages/fleet/fleet.cattle.io.application.po';
import { HeaderPo } from '@/e2e/po/components/header.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import { fleetWorkspacesSmallResponse, fleetWorkspacesLargeResponse } from '@/e2e/blueprints/fleet/workspaces-get';
import { setTablePreferences, restoreTablePreferences } from '@/e2e/tests/pages/explorer2/workloads/pagination.utils';
import * as jsyaml from 'js-yaml';
import * as fs from 'fs';

test.describe('Workspaces', { tag: ['@fleet', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@noVai'] }, () => {
    test('check table headers are available in list view', async ({ page, login }) => {
      await login();
      const listPage = new FleetWorkspaceListPagePo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      await expect(listPage.list().resourceTable().sortableTable().rowWithName('fleet-default').self()).toBeVisible();
      await expect(listPage.list().resourceTable().sortableTable().noRowsText()).not.toBeAttached();

      const expectedHeaders = ['State', 'Name', 'Git Repos', 'Helm Ops', 'Clusters', 'Cluster Groups', 'Age'];
      const actualHeaders = await listPage.list().resourceTable().sortableTable().headerNames();

      expect(actualHeaders).toEqual(expectedHeaders);
    });

    test('pagination is visible and navigable with large dataset', async ({ page, login, rancherApi }) => {
      const MOCK_COUNT = 25;
      const savedPrefs = await setTablePreferences(rancherApi, []);
      const mockData = fleetWorkspacesLargeResponse(MOCK_COUNT);

      try {
        await page.route(/\/v1\/management\.cattle\.io\.fleetworkspaces/, (route) => {
          const url = route.request().url();

          if (url.includes('watch=true') || url.includes('resourceVersion')) {
            return route.abort();
          }

          return route.fulfill({ json: mockData });
        });

        await login();
        const listPage = new FleetWorkspaceListPagePo(page);

        await listPage.goTo();
        await listPage.waitForPage();

        const table = listPage.list().resourceTable().sortableTable();

        await expect(table.self()).toBeVisible();
        await table.checkLoadingIndicatorNotVisible();

        await expect(table.pagination()).toBeVisible();
        await expect(table.paginationText()).toContainText(`1 - 10 of ${MOCK_COUNT}`);

        await expect(table.paginationBeginButton()).toBeDisabled();
        await expect(table.paginationPrevButton()).toBeDisabled();
        await expect(table.paginationNextButton()).toBeEnabled();
        await expect(table.paginationEndButton()).toBeEnabled();

        // Navigate right → page 2
        await table.paginationNextButton().click();
        await expect(table.paginationText()).toContainText(`11 - 20 of ${MOCK_COUNT}`);
        await expect(table.paginationBeginButton()).toBeEnabled();

        // Navigate left → page 1
        await table.paginationPrevButton().click();
        await expect(table.paginationText()).toContainText(`1 - 10 of ${MOCK_COUNT}`);

        // Navigate to last page
        await table.paginationEndButton().click();
        await expect(table.paginationText()).toContainText(`21 - ${MOCK_COUNT} of ${MOCK_COUNT}`);

        // Navigate to first page
        await table.paginationBeginButton().click();
        await expect(table.paginationText()).toContainText(`1 - 10 of ${MOCK_COUNT}`);
      } finally {
        await restoreTablePreferences(rancherApi, savedPrefs);
      }
    });

    test('filter workspace', async ({ page, login, rancherApi }) => {
      const wsName = rancherApi.createE2EResourceName('fleet-ws-filt');

      await rancherApi.createRancherResource('v3', 'fleetworkspaces', {
        metadata: { name: wsName },
        name: wsName,
      });

      const savedPrefs = await setTablePreferences(rancherApi, []);

      try {
        await login();
        const listPage = new FleetWorkspaceListPagePo(page);

        await listPage.goTo();
        await listPage.waitForPage();

        const table = listPage.list().resourceTable().sortableTable();

        await expect(table.self()).toBeVisible();
        await table.checkLoadingIndicatorNotVisible();

        // Filter by created workspace name
        await table.filter(wsName);
        await expect(table.rowElements()).toHaveCount(1);
        await expect(table.rowElementWithName(wsName)).toBeVisible();

        // Reset filter — verify the default workspaces reappear
        await table.resetFilter();
        await expect(table.rowElementWithName('fleet-default')).toBeVisible();
      } finally {
        await restoreTablePreferences(rancherApi, savedPrefs);
        await rancherApi.deleteRancherResource('v3', 'fleetWorkspaces', wsName, false);
      }
    });

    test('sorting changes the order of paginated workspace data', async ({ page, login, rancherApi }) => {
      const savedPrefs = await setTablePreferences(rancherApi, []);

      try {
        await login();
        const listPage = new FleetWorkspaceListPagePo(page);

        await listPage.goTo();
        await listPage.waitForPage();

        const table = listPage.list().resourceTable().sortableTable();

        await expect(table.self()).toBeVisible();
        await table.checkLoadingIndicatorNotVisible();

        // Click State (col 1) to clear any existing Name sort state
        await table.sort(1).click();
        await expect(table.sortIcon(1, 'down')).toBeVisible();

        // Click Name (col 2) — first click sets ASC
        await table.sort(2).click();
        await expect(table.sortIcon(2, 'down')).toBeVisible();

        // Toggle to DESC
        await table.sort(2).click();
        await expect(table.sortIcon(2, 'up')).toBeVisible();
      } finally {
        await restoreTablePreferences(rancherApi, savedPrefs);
      }
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

      await expect(table.self()).toBeVisible();
      await table.checkLoadingIndicatorNotVisible();
      await expect(table.rowElements()).toHaveCount(2);
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
        await expect(listPage.list().resourceTable().sortableTable().noRowsText()).not.toBeAttached();
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
        await expect(listPage.list().resourceTable().sortableTable().rowWithName(customWorkspace).self()).toBeVisible();
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
        await expect(headerPo.workspaceSwitcher()).toContainText(wsName);
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
        await expect(listPage.list().resourceTable().sortableTable().noRowsText()).not.toBeAttached();

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
        await expect(listPage.list().resourceTable().sortableTable().noRowsText()).not.toBeAttached();

        const actionMenu = await listPage.list().actionMenu(customWorkspace);

        const [download] = await Promise.all([
          page.waitForEvent('download'),
          actionMenu.getMenuItem('Download YAML').click(),
        ]);

        expect(download.suggestedFilename()).toBe(`${customWorkspace}.yaml`);

        const downloadPath = await download.path();
        const yamlContent = fs.readFileSync(downloadPath!, 'utf-8');
        const parsed: any = jsyaml.load(yamlContent);

        expect(parsed.kind).toBe('FleetWorkspace');
        expect(parsed.metadata.name).toBe(customWorkspace);
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
        await expect(listPage.list().resourceTable().sortableTable().noRowsText()).not.toBeAttached();
        await expect(listPage.list().resourceTable().sortableTable().rowElementWithName(deleteName)).toBeVisible();

        const actionMenu = await listPage.list().actionMenu(deleteName);

        await actionMenu.getMenuItem('Delete').click();

        const responsePromise = page.waitForResponse(
          (resp) => resp.url().includes(`/v3/fleetWorkspaces/${deleteName}`) && resp.request().method() === 'DELETE',
        );

        const prompt = new PromptRemove(page);

        await prompt.confirmField().set(deleteName);
        await prompt.remove();
        await responsePromise;

        // Fleet lists update via websocket — navigate fresh to ensure data after delete
        await listPage.goTo();
        await listPage.waitForPage();

        await expect(listPage.list().resourceTable().sortableTable().rowElementWithName(deleteName)).not.toBeAttached();
      } finally {
        await rancherApi.deleteRancherResource('v3', 'fleetWorkspaces', deleteName, false);
      }
    });
  });
});
