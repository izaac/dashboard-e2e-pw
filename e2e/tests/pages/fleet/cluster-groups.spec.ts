import { test, expect } from '@/support/fixtures';
import {
  FleetClusterGroupsListPagePo,
  FleetClusterGroupsCreateEditPo,
  FleetClusterGroupDetailsPo,
} from '@/e2e/po/pages/fleet/fleet.cattle.io.clustergroup.po';
import { HeaderPo } from '@/e2e/po/components/header.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';

const localWorkspace = 'fleet-local';

test.describe('Cluster Groups', { tag: ['@fleet', '@adminUser'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('can create cluster group', async ({ page, rancherApi }) => {
    const clusterGroupName = rancherApi.createE2EResourceName('cg-create');
    const listPage = new FleetClusterGroupsListPagePo(page);
    const headerPo = new HeaderPo(page);

    try {
      await listPage.goTo();
      await listPage.waitForPage();
      await headerPo.selectWorkspace(localWorkspace);
      await listPage.baseResourceList().masthead().create();

      const createPage = new FleetClusterGroupsCreateEditPo(page);

      await createPage.waitForPage();

      await createPage.resourceDetail().createEditView().nameNsDescription().name().set(clusterGroupName);

      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('v1/fleet.cattle.io.clustergroups') && resp.request().method() === 'POST',
      );

      await createPage.resourceDetail().cruResource().saveOrCreate().click();
      await responsePromise;

      await listPage.waitForPage();
      await expect(listPage.resourceTableDetails(clusterGroupName, 1)).toBeVisible();
    } finally {
      await rancherApi.deleteRancherResource(
        'v1',
        'fleet.cattle.io.clustergroups',
        `${localWorkspace}/${clusterGroupName}`,
        false,
      );
    }
  });

  test('can edit a cluster group', async ({ page, rancherApi }) => {
    const clusterGroupName = rancherApi.createE2EResourceName('cg-edit');

    await rancherApi.createRancherResource('v1', 'fleet.cattle.io.clustergroups', {
      type: 'fleet.cattle.io.clustergroup',
      metadata: { namespace: localWorkspace, name: clusterGroupName },
      spec: {},
    });

    try {
      const listPage = new FleetClusterGroupsListPagePo(page);
      const headerPo = new HeaderPo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      await headerPo.selectWorkspace(localWorkspace);

      const actionMenu = await listPage.list().actionMenu(clusterGroupName);

      await actionMenu.getMenuItem('Edit Config').click();

      const editPage = new FleetClusterGroupsCreateEditPo(page, localWorkspace, clusterGroupName);

      await editPage.waitForPage('mode=edit');
      await editPage
        .resourceDetail()
        .createEditView()
        .nameNsDescription()
        .description()
        .set(`${clusterGroupName}-fleet-desc`);

      const responsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes(`v1/fleet.cattle.io.clustergroups/${localWorkspace}/${clusterGroupName}`) &&
          resp.request().method() === 'PUT',
      );

      await editPage.resourceDetail().createEditView().save();
      const response = await responsePromise;
      const body = await response.json();

      expect(response.status()).toBe(200);
      expect(body.metadata.name).toBe(clusterGroupName);
      expect(body.metadata.annotations['field.cattle.io/description']).toBe(`${clusterGroupName}-fleet-desc`);

      await listPage.waitForPage();
    } finally {
      await rancherApi.deleteRancherResource(
        'v1',
        'fleet.cattle.io.clustergroups',
        `${localWorkspace}/${clusterGroupName}`,
        false,
      );
    }
  });

  test('can clone a cluster group', async ({ page, rancherApi }) => {
    const clusterGroupName = rancherApi.createE2EResourceName('cg-clone');
    const cloneName = `clone-${clusterGroupName}`;

    await rancherApi.createRancherResource('v1', 'fleet.cattle.io.clustergroups', {
      type: 'fleet.cattle.io.clustergroup',
      metadata: { namespace: localWorkspace, name: clusterGroupName },
      spec: {},
    });

    try {
      const listPage = new FleetClusterGroupsListPagePo(page);
      const headerPo = new HeaderPo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      await headerPo.selectWorkspace(localWorkspace);

      const actionMenu = await listPage.list().actionMenu(clusterGroupName);

      await actionMenu.getMenuItem('Clone').click();

      const clonePage = new FleetClusterGroupsCreateEditPo(page, localWorkspace, clusterGroupName);

      await clonePage.waitForPage('mode=clone');
      await clonePage.resourceDetail().createEditView().nameNsDescription().name().set(cloneName);
      await clonePage
        .resourceDetail()
        .createEditView()
        .nameNsDescription()
        .description()
        .set(`${clusterGroupName}-fleet-desc`);

      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('v1/fleet.cattle.io.clustergroups') && resp.request().method() === 'POST',
      );

      await clonePage.resourceDetail().createEditView().create();
      const response = await responsePromise;
      const body = await response.json();

      expect(response.status()).toBe(201);
      expect(body.metadata.name).toBe(cloneName);
      expect(body.metadata.annotations['field.cattle.io/description']).toBe(`${clusterGroupName}-fleet-desc`);

      await listPage.waitForPage();
      await expect(listPage.resourceTableDetails(cloneName, 1)).toBeVisible();
    } finally {
      await rancherApi.deleteRancherResource(
        'v1',
        'fleet.cattle.io.clustergroups',
        `${localWorkspace}/${clusterGroupName}`,
        false,
      );
      await rancherApi.deleteRancherResource(
        'v1',
        'fleet.cattle.io.clustergroups',
        `${localWorkspace}/${cloneName}`,
        false,
      );
    }
  });

  test('can delete cluster group', async ({ page, rancherApi }) => {
    const clusterGroupName = rancherApi.createE2EResourceName('cg-del');

    await rancherApi.createRancherResource('v1', 'fleet.cattle.io.clustergroups', {
      type: 'fleet.cattle.io.clustergroup',
      metadata: { namespace: localWorkspace, name: clusterGroupName },
      spec: {},
    });

    const listPage = new FleetClusterGroupsListPagePo(page);
    const headerPo = new HeaderPo(page);

    try {
      await listPage.goTo();
      await listPage.waitForPage();
      await headerPo.selectWorkspace(localWorkspace);

      const rowCountBefore = await listPage.list().resourceTable().sortableTable().rowCount();

      const actionMenu = await listPage.list().actionMenu(clusterGroupName);

      await actionMenu.getMenuItem('Delete').click();

      const deletePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes(`v1/fleet.cattle.io.clustergroups/${localWorkspace}/${clusterGroupName}`) &&
          resp.request().method() === 'DELETE',
      );

      const promptRemove = new PromptRemove(page);

      await promptRemove.remove();
      await deletePromise;

      await listPage.waitForPage();
      await expect(listPage.list().resourceTable().sortableTable().rowElements()).toHaveCount(rowCountBefore - 1);

      await expect(
        listPage.list().resourceTable().sortableTable().rowElementWithName(clusterGroupName),
      ).not.toBeAttached();
    } finally {
      await rancherApi.deleteRancherResource(
        'v1',
        'fleet.cattle.io.clustergroups',
        `${localWorkspace}/${clusterGroupName}`,
        false,
      );
    }
  });

  // Regression: https://github.com/rancher/dashboard/issues/11687
  test('can open "Edit as YAML"', async ({ page }) => {
    const listPage = new FleetClusterGroupsListPagePo(page);

    await listPage.goTo();
    await listPage.waitForPage();
    await listPage.baseResourceList().masthead().create();

    const createPage = new FleetClusterGroupsCreateEditPo(page);

    await createPage.resourceDetail().createEditView().editAsYaml();
    await expect(createPage.resourceDetail().resourceYaml().codeMirror().self()).toBeAttached();
  });

  test(
    'check table headers are available in list and details view',
    { tag: ['@noVai', '@adminUser'] },
    async ({ page }) => {
      const groupName = 'default';
      const listPage = new FleetClusterGroupsListPagePo(page);
      const headerPo = new HeaderPo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      await headerPo.selectWorkspace(localWorkspace);
      await expect(listPage.list().rowWithName(groupName).self()).toBeVisible();

      const expectedHeaders = ['State', 'Name', 'Clusters Ready', 'Resources', 'Age'];
      const actualHeaders = await listPage.list().resourceTable().sortableTable().headerNames();

      expect(actualHeaders).toEqual(expectedHeaders);

      await listPage.goToDetailsPage(groupName);

      const detailsPage = new FleetClusterGroupDetailsPo(page, localWorkspace, groupName);

      await detailsPage.waitForPage(undefined, 'clusters');

      const expectedHeadersDetailsView = [
        'State',
        'Name',
        'Git Repos Ready',
        'Helm Ops Ready',
        'Bundles Ready',
        'Resources',
        'Last Seen',
        'Age',
      ];
      const detailHeaders = await detailsPage.clusterList().sortableTable().headerNames();

      expect(detailHeaders).toEqual(expectedHeadersDetailsView);
    },
  );
});
