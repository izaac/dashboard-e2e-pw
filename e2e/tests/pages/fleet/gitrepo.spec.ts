import { test, expect } from '@/support/fixtures';
import {
  FleetApplicationListPagePo,
  FleetGitRepoCreateEditPo,
  FleetGitRepoDetailsPo,
} from '@/e2e/po/pages/fleet/fleet.cattle.io.application.po';
import { gitRepoTargetAllClustersRequest } from '@/e2e/blueprints/fleet/gitrepos';
import { HeaderPo } from '@/e2e/po/components/header.po';

/**
 * Git Repo spec — converted from upstream fleet/gitrepo.spec.ts.
 *
 * Tests that create GitRepos targeting fake/downstream clusters are skipped:
 * the Create test exercises fake cluster intercepts that require real multi-cluster
 * fleet setup. The table-header, details-view, and CRUD tests need an existing
 * git repo in fleet-default (created in upstream before() hook with rancherApi).
 */

const workspace = 'fleet-default';
const repoInfo = {
  repoUrl: 'https://github.com/rancher/fleet-examples.git',
  branch: 'master',
  paths: 'simple',
};

test.describe('Git Repo', { tag: ['@fleet', '@adminUser'] }, () => {
  test('Can create a GitRepo', async () => {
    test.skip(true, 'Requires downstream clusters — fake cluster intercepts need real fleet multi-cluster setup');
  });

  test('check table headers are available in list and details view', async ({ page, login, rancherApi }) => {
    const gitRepoName = rancherApi.createE2EResourceName('gitrepo-headers');

    await login();

    await rancherApi.createRancherResource(
      'v1',
      'fleet.cattle.io.gitrepos',
      gitRepoTargetAllClustersRequest(workspace, gitRepoName, repoInfo.repoUrl, repoInfo.branch, repoInfo.paths),
    );

    const listPage = new FleetApplicationListPagePo(page);
    const header = new HeaderPo(page);

    try {
      await listPage.goTo();
      await listPage.waitForPage();
      await header.selectWorkspace(workspace);

      const expectedHeadersListView = [
        'State',
        'Name',
        'Type',
        'Source',
        'Target',
        'Clusters Ready',
        'Resources',
        'Age',
      ];

      await expect(listPage.sortableTable().self()).toBeVisible();
      const actualHeaders = await listPage.sortableTable().headerNames();

      expect(actualHeaders).toEqual(expectedHeadersListView);

      await listPage.goToDetailsPage(gitRepoName);

      const gitRepoDetails = new FleetGitRepoDetailsPo(page, workspace, gitRepoName);

      await gitRepoDetails.waitForPage(undefined, 'bundles');

      const expectedHeadersDetailsView = ['State', 'Name', 'Deployments', 'Last Updated', 'Date'];

      await expect(gitRepoDetails.bundlesList().self()).toBeVisible();
      const actualHeadersDetailsView = await gitRepoDetails.bundlesList().headerNames();

      expect(actualHeadersDetailsView).toEqual(expectedHeadersDetailsView);
    } finally {
      await rancherApi.deleteRancherResource('v1', `fleet.cattle.io.gitrepos/${workspace}`, gitRepoName, false);
    }
  });

  test('check all tabs are available in the details view', async ({ page, login, rancherApi }) => {
    const gitRepoName = rancherApi.createE2EResourceName('gitrepo-tabs');

    await login();

    await rancherApi.createRancherResource(
      'v1',
      'fleet.cattle.io.gitrepos',
      gitRepoTargetAllClustersRequest(workspace, gitRepoName, repoInfo.repoUrl, repoInfo.branch, repoInfo.paths),
    );

    const listPage = new FleetApplicationListPagePo(page);
    const header = new HeaderPo(page);

    try {
      await listPage.goTo();
      await listPage.waitForPage();
      await header.selectWorkspace(workspace);
      await listPage.goToDetailsPage(gitRepoName);

      const gitRepoDetails = new FleetGitRepoDetailsPo(page, workspace, gitRepoName);

      await gitRepoDetails.waitForPage(undefined, 'bundles');

      const expectedTabs = ['Bundles', 'Resources', 'Conditions', 'Recent Events'];
      const tabs = gitRepoDetails.gitRepoTabs().allTabs();

      await expect(tabs).toHaveCount(expectedTabs.length, { timeout: 10000 });

      for (const name of expectedTabs) {
        await expect(tabs.filter({ hasText: name })).toHaveCount(1);
      }
    } finally {
      await rancherApi.deleteRancherResource('v1', `fleet.cattle.io.gitrepos/${workspace}`, gitRepoName, false);
    }
  });

  test.describe('Edit', () => {
    test('Can Clone a git repo', async ({ page, login, rancherApi }) => {
      const editRepoName = rancherApi.createE2EResourceName('gitrepo-clone');
      let cloneName = '';

      await login();

      await rancherApi.createRancherResource(
        'v1',
        'fleet.cattle.io.gitrepos',
        gitRepoTargetAllClustersRequest(workspace, editRepoName, repoInfo.repoUrl, repoInfo.branch, repoInfo.paths),
      );

      const listPage = new FleetApplicationListPagePo(page);
      const header = new HeaderPo(page);

      try {
        await listPage.goTo();
        await listPage.waitForPage();
        await header.selectWorkspace(workspace);

        const cloneMenu = await listPage.list().actionMenu(editRepoName);

        await cloneMenu.getMenuItem('Clone').click();

        const gitRepoEditPage = new FleetGitRepoCreateEditPo(page, workspace, editRepoName);

        await gitRepoEditPage.waitForPage('mode=clone');

        await expect(gitRepoEditPage.mastheadTitleLocator()).toContainText(`App Bundle: Clone from ${editRepoName}`);

        cloneName = `clone-${editRepoName}`;

        await gitRepoEditPage.resourceDetail().createEditView().nameNsDescription().name().set(cloneName);
        await gitRepoEditPage.resourceDetail().createEditView().nextPage();
        await gitRepoEditPage.resourceDetail().createEditView().nextPage();
        await gitRepoEditPage.resourceDetail().createEditView().nextPage();
        await gitRepoEditPage.resourceDetail().createEditView().create();

        await listPage.waitForPage();
        await expect(listPage.sortableTable().rowElementWithName(cloneName)).toBeVisible();
      } finally {
        if (cloneName) {
          await rancherApi.deleteRancherResource('v1', `fleet.cattle.io.gitrepos/${workspace}`, cloneName, false);
        }
        await rancherApi.deleteRancherResource('v1', `fleet.cattle.io.gitrepos/${workspace}`, editRepoName, false);
      }
    });

    test('Can Edit Yaml', async ({ page, login, rancherApi }) => {
      const editRepoName = rancherApi.createE2EResourceName('gitrepo-yaml');

      await login();

      await rancherApi.createRancherResource(
        'v1',
        'fleet.cattle.io.gitrepos',
        gitRepoTargetAllClustersRequest(workspace, editRepoName, repoInfo.repoUrl, repoInfo.branch, repoInfo.paths),
      );

      const listPage = new FleetApplicationListPagePo(page);
      const header = new HeaderPo(page);

      try {
        await listPage.goTo();
        await listPage.waitForPage();
        await header.selectWorkspace(workspace);

        const yamlMenu = await listPage.list().actionMenu(editRepoName);

        await yamlMenu.getMenuItem('Edit YAML').click();

        const gitRepoEditPage = new FleetGitRepoCreateEditPo(page, workspace, editRepoName);

        await gitRepoEditPage.waitForPage('mode=edit&as=yaml');

        await expect(gitRepoEditPage.mastheadTitleLocator()).toContainText(`App Bundle: ${editRepoName}`);
      } finally {
        await rancherApi.deleteRancherResource('v1', `fleet.cattle.io.gitrepos/${workspace}`, editRepoName, false);
      }
    });

    test('Can Download Yaml', async ({ page, login, rancherApi }) => {
      const editRepoName = rancherApi.createE2EResourceName('gitrepo-dl');

      await login();

      await rancherApi.createRancherResource(
        'v1',
        'fleet.cattle.io.gitrepos',
        gitRepoTargetAllClustersRequest(workspace, editRepoName, repoInfo.repoUrl, repoInfo.branch, repoInfo.paths),
      );

      const listPage = new FleetApplicationListPagePo(page);
      const header = new HeaderPo(page);

      try {
        await listPage.goTo();
        await listPage.waitForPage();
        await header.selectWorkspace(workspace);

        const downloadMenu = await listPage.list().actionMenu(editRepoName);

        await downloadMenu.getMenuItem('Download YAML').click();

        await expect(listPage.sortableTable().self()).toBeVisible();
      } finally {
        await rancherApi.deleteRancherResource('v1', `fleet.cattle.io.gitrepos/${workspace}`, editRepoName, false);
      }
    });

    test('Can Edit Config', async ({ page, login, rancherApi }) => {
      const editRepoName = rancherApi.createE2EResourceName('gitrepo-edit');
      const description = `${editRepoName}-desc`;

      await login();

      await rancherApi.createRancherResource(
        'v1',
        'fleet.cattle.io.gitrepos',
        gitRepoTargetAllClustersRequest(workspace, editRepoName, repoInfo.repoUrl, repoInfo.branch, repoInfo.paths),
      );

      const listPage = new FleetApplicationListPagePo(page);
      const header = new HeaderPo(page);

      try {
        await listPage.goTo();
        await listPage.waitForPage();
        await header.selectWorkspace(workspace);

        const editMenu = await listPage.list().actionMenu(editRepoName);

        await editMenu.getMenuItem('Edit Config').click();

        const gitRepoEditPage = new FleetGitRepoCreateEditPo(page, workspace, editRepoName);

        await gitRepoEditPage.waitForPage('mode=edit');
        await gitRepoEditPage.resourceDetail().createEditView().nameNsDescription().description().set(description);
        await gitRepoEditPage.resourceDetail().createEditView().nextPage();
        await gitRepoEditPage.resourceDetail().createEditView().save();
      } finally {
        await rancherApi.deleteRancherResource('v1', `fleet.cattle.io.gitrepos/${workspace}`, editRepoName, false);
      }
    });
  });

  test.describe('Visual Testing', { tag: ['@percy', '@manager', '@adminUser'] }, () => {
    test('should display continuous delivery page git repo', async () => {
      test.skip(true, 'Percy visual testing — requires Percy CLI and token');
    });
  });
});
