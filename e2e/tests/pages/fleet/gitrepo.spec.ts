import { test, expect } from '@/support/fixtures';
import * as fs from 'fs';
import * as jsyaml from 'js-yaml';
import {
  FleetApplicationListPagePo,
  FleetGitRepoCreateEditPo,
  FleetGitRepoDetailsPo,
  FleetGitRepoListPagePo,
} from '@/e2e/po/pages/fleet/fleet.cattle.io.application.po';
import { gitRepoTargetAllClustersRequest } from '@/e2e/blueprints/fleet/gitrepos';
import { HeaderPo } from '@/e2e/po/components/header.po';
import { BRIEF, LONG, STANDARD } from '@/support/timeouts';
import { ensureLightTheme, chromeMasks, visualSnapshot } from '@/support/utils/visual-snapshot';
import { generateFakeClusterDataAndIntercepts } from '@/e2e/blueprints/nav/fake-cluster';

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
  test('Can create a GitRepo with GitHub App git authentication', async ({ page, login, rancherApi }) => {
    const fakeProvClusterId = rancherApi.createE2EResourceName('gh-app-prov');
    const fakeMgmtClusterId = `c-${fakeProvClusterId}`;
    const gitRepoName = rancherApi.createE2EResourceName('gitrepo-ghapp');

    const appId = '12345';
    const installationId = '67890';
    const privateKey = '-----BEGIN RSA PRIVATE KEY-----\nFAKEKEYCONTENT\n-----END RSA PRIVATE KEY-----';

    // Route must be set up BEFORE login so fake cluster data is active when the page loads
    await generateFakeClusterDataAndIntercepts(page, { fakeProvClusterId, fakeMgmtClusterId });

    const secretResponse = page.waitForResponse(
      (resp) => resp.url().includes(`/v1/secrets/${workspace}`) && resp.request().method() === 'POST',
    );

    await login();

    const listPage = new FleetApplicationListPagePo(page);
    const header = new HeaderPo(page);
    const gitRepoCreatePage = new FleetGitRepoCreateEditPo(page);

    try {
      await listPage.goTo();
      await listPage.waitForPage();
      await header.selectWorkspace(workspace);

      await gitRepoCreatePage.goTo();
      await gitRepoCreatePage.waitForPage();

      // Step 1: Metadata
      await gitRepoCreatePage.resourceDetail().createEditView().nameNsDescription().name().set(gitRepoName);
      await gitRepoCreatePage.resourceDetail().createEditView().nextPage();

      // Step 2: Repository details
      await gitRepoCreatePage.setGitRepoUrl(repoInfo.repoUrl);
      await gitRepoCreatePage.setBranchName(repoInfo.branch);
      await gitRepoCreatePage.setGitRepoPath(repoInfo.paths);
      await gitRepoCreatePage.resourceDetail().createEditView().nextPage();

      // Step 3: Target selection
      await gitRepoCreatePage.targetClusterOptions().set(1);
      await gitRepoCreatePage.targetClusterOptions().set(2);
      await gitRepoCreatePage.targetCluster().dropdown().click();
      await gitRepoCreatePage.targetCluster().clickOptionWithLabel(fakeProvClusterId);
      await gitRepoCreatePage.resourceDetail().createEditView().nextPage();

      // Step 4: Advanced - create GitHub App auth secret
      await gitRepoCreatePage.gitAuthSelectOrCreate().createGitHubAppAuth(appId, installationId, privateKey);

      await gitRepoCreatePage.resourceDetail().createEditView().createButton().click();

      const response = await secretResponse;

      expect(response.status()).toBe(201);

      const requestBody = response.request().postDataJSON();

      expect(requestBody.metadata.labels['fleet.cattle.io/managed']).toBe('true');
      expect(requestBody.data['github_app_id']).toBe(Buffer.from(appId).toString('base64'));
      expect(requestBody.data['github_app_installation_id']).toBe(Buffer.from(installationId).toString('base64'));
      expect(requestBody.data['github_app_private_key']).toBe(Buffer.from(privateKey).toString('base64'));
    } finally {
      await rancherApi.deleteRancherResource('v1', 'fleet.cattle.io.gitrepos', `${workspace}/${gitRepoName}`, false);
      await page.unroute('**/v1/**');
    }
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

      await expect(tabs).toHaveCount(expectedTabs.length, { timeout: STANDARD });

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
        await gitRepoEditPage.resourceDetail().createEditView().saveButtonPo().click();
        await gitRepoEditPage.resourceDetail().createEditView().saveButtonPo().click();
        await gitRepoEditPage.resourceDetail().createEditView().saveButtonPo().click();
        await gitRepoEditPage.resourceDetail().createEditView().createButton().click();

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

        const downloadPromise = page.waitForEvent('download');
        const downloadMenu = await listPage.list().actionMenu(editRepoName);

        await downloadMenu.getMenuItem('Download YAML').click();
        const download = await downloadPromise;

        expect(download.suggestedFilename()).toContain(editRepoName);

        const yamlContent = fs.readFileSync((await download.path()) as string, 'utf-8');
        const parsed: any = jsyaml.load(yamlContent);

        expect(parsed.kind).toBe('GitRepo');
        expect(parsed.metadata.name).toBe(editRepoName);

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

        // Wizard has 4 steps (Metadata → Repository details → Target details → Advanced).
        // Click Next until the primary button changes label to "Save", then click once more.
        const primary = gitRepoEditPage.resourceDetail().createEditView().saveButtonPo().self();

        await expect
          .poll(async () => (await primary.innerText()).trim().toLowerCase(), { timeout: LONG, intervals: [BRIEF] })
          .toMatch(/next|save/);

        let reachedSave = false;

        for (let i = 0; i < 5; i++) {
          const label = (await primary.innerText()).trim().toLowerCase();

          if (label === 'save') {
            reachedSave = true;
            break;
          }
          await primary.click();
        }

        // Surface a clear failure if the wizard never reaches the Save step rather
        // than letting the trailing primary.click() fire on a Next button and the
        // assertions further down silently miss the actual save POST.
        expect(reachedSave, 'Wizard primary button never reached "Save" within 5 Next-click iterations').toBe(true);

        await primary.click();

        await listPage.waitForPage();
        await expect(listPage.sortableTable().rowElementWithName(editRepoName)).toBeVisible();
      } finally {
        await rancherApi.deleteRancherResource('v1', `fleet.cattle.io.gitrepos/${workspace}`, editRepoName, false);
      }
    });
  });

  test.describe('Visual snapshots', { tag: ['@visual', '@manager', '@adminUser'] }, () => {
    test('git repo list page matches snapshot', async ({ page, login, rancherApi, isPrime }) => {
      await login();
      const restoreTheme = await ensureLightTheme(rancherApi);

      try {
        const gitRepoList = new FleetGitRepoListPagePo(page);

        await gitRepoList.goTo();
        await gitRepoList.waitForPage();
        // TODO: Empty fleet continuous-delivery state renders a "Get Started"
        // panel rather than a sortable table, and the standard PagePo masthead
        // selectors don't match. Need to identify a stable wait anchor for
        // this page specifically before we can trust the screenshot. Until
        // then, networkidle is the pragmatic fallback for visual stability.
        // eslint-disable-next-line playwright/no-networkidle -- visual snapshot needs all assets settled
        await page.waitForLoadState('networkidle');

        // Empty-state guard: peer tests in this spec create-and-delete gitrepos. A finalizer
        // that has not yet reconciled leaves a `Removing...` row in the list and blows up the
        // visual diff. Poll until the table body has zero rows before screenshotting.
        await expect
          .poll(async () => await gitRepoList.sortableTable().rowElements().count(), {
            timeout: LONG,
            intervals: [BRIEF],
          })
          .toBe(0);

        await expect(page).toHaveScreenshot(visualSnapshot(isPrime, 'gitrepo-list.png'), {
          fullPage: true,
          mask: chromeMasks(page),
        });
      } finally {
        await restoreTheme();
      }
    });
  });
});
