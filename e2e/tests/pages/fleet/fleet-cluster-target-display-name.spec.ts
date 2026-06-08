import { test, expect } from '@/support/fixtures';
import {
  FleetApplicationListPagePo,
  FleetGitRepoCreateEditPo,
} from '@/e2e/po/pages/fleet/fleet.cattle.io.application.po';
import { gitRepoTargetAllClustersRequest } from '@/e2e/blueprints/fleet/gitrepos';
import { HeaderPo } from '@/e2e/po/components/header.po';
import { SAFE_RESOURCE_REVISION } from '@/e2e/blueprints/blueprint.utils';
import type { Page } from '@playwright/test';

const METADATA_NAME = 'c-m-e2etest';
const DISPLAY_NAME = 'e2e-custom-display-cluster';
const workspace = 'fleet-default';

const repoInfo = {
  repoUrl: 'https://github.com/rancher/fleet-examples.git',
  branch: 'master',
  paths: 'simple',
};

/**
 * Injects a fake fleet cluster that carries the `cluster-display-name` label into
 * every fleet clusters list response. The display name differs from metadata.name,
 * which is what these tests assert the UI resolves and submits.
 */
async function interceptFleetClustersWithDisplayName(page: Page): Promise<void> {
  await page.route('**/v1/fleet.cattle.io.clusters?*', async (route) => {
    const response = await route.fetch();

    if (response.status() !== 200) {
      await route.fulfill({ response });

      return;
    }

    const body = await response.json();

    body.data.push({
      id: `${workspace}/${METADATA_NAME}`,
      type: 'fleet.cattle.io.cluster',
      metadata: {
        name: METADATA_NAME,
        namespace: workspace,
        labels: {
          'management.cattle.io/cluster-display-name': DISPLAY_NAME,
          'management.cattle.io/cluster-name': METADATA_NAME,
        },
        state: {
          name: 'active',
          error: false,
          transitioning: false,
          message: 'Resource is Ready',
        },
        resourceVersion: SAFE_RESOURCE_REVISION,
      },
      spec: {},
      status: {
        agent: { lastSeen: '2026-01-01T00:00:00Z' },
        display: {
          readyBundles: '0/0',
          state: 'Active',
        },
      },
    });

    await route.fulfill({ response, json: body });
  });
}

async function goToTargetStep(gitRepoCreatePage: FleetGitRepoCreateEditPo, name: string): Promise<void> {
  await gitRepoCreatePage.goTo();
  await gitRepoCreatePage.waitForPage();

  // Step 1: Metadata
  await gitRepoCreatePage.resourceDetail().createEditView().nameNsDescription().name().set(name);
  await gitRepoCreatePage.resourceDetail().createEditView().saveButtonPo().click();

  // Step 2: Repository details (fill auto-waits for actionability)
  await gitRepoCreatePage.setGitRepoUrl(repoInfo.repoUrl);
  await gitRepoCreatePage.setBranchName(repoInfo.branch);
  await gitRepoCreatePage.setGitRepoPath(repoInfo.paths);
  await gitRepoCreatePage.resourceDetail().createEditView().saveButtonPo().click();

  // Step 3: Target — wait for radio options to render
  await expect(gitRepoCreatePage.targetClusterOptions().getOptionByIndex(2)).toBeVisible();
  await gitRepoCreatePage.targetClusterOptions().set(2);
}

test.describe('Fleet Cluster Targets - Display Name', { tag: ['@fleet', '@adminUser'] }, () => {
  test('shows cluster display name (not metadata.name) in the target selector dropdown', async ({
    page,
    login,
    rancherApi,
  }) => {
    await interceptFleetClustersWithDisplayName(page);
    await login();

    const listPage = new FleetApplicationListPagePo(page);
    const header = new HeaderPo(page);

    await listPage.goTo();
    await listPage.waitForPage();
    await header.selectWorkspace(workspace);

    const gitRepoCreatePage = new FleetGitRepoCreateEditPo(page);

    await goToTargetStep(gitRepoCreatePage, rancherApi.createE2EResourceName('display-name-dropdown'));

    await gitRepoCreatePage.targetCluster().dropdown().click();

    const options = await gitRepoCreatePage.targetCluster().getOptionsAsStrings();

    expect(options.some((opt) => opt.includes(DISPLAY_NAME))).toBe(true);
    expect(options.some((opt) => opt === METADATA_NAME)).toBe(false);
  });

  test('uses display name as clusterName value when selecting a cluster target', async ({
    page,
    login,
    rancherApi,
  }) => {
    await interceptFleetClustersWithDisplayName(page);
    await login();

    const gitRepoName = rancherApi.createE2EResourceName('display-name-value');
    const listPage = new FleetApplicationListPagePo(page);
    const header = new HeaderPo(page);

    await listPage.goTo();
    await listPage.waitForPage();
    await header.selectWorkspace(workspace);

    const gitRepoCreatePage = new FleetGitRepoCreateEditPo(page);

    try {
      await goToTargetStep(gitRepoCreatePage, gitRepoName);

      await gitRepoCreatePage.targetCluster().dropdown().click();
      await gitRepoCreatePage.targetCluster().clickOptionWithLabel(DISPLAY_NAME);

      const createRequest = page.waitForRequest(
        (req) => req.url().includes('/v1/fleet.cattle.io.gitrepos') && req.method() === 'POST',
      );

      // Advance from Target to Advanced step
      await gitRepoCreatePage.resourceDetail().createEditView().saveButtonPo().click();
      // Wait for Advanced step to render before submitting
      await expect(gitRepoCreatePage.resourceDetail().createEditView().createButton().self()).toBeVisible();
      await gitRepoCreatePage.resourceDetail().createEditView().createButton().click();

      const request = await createRequest;
      const targets = JSON.parse(request.postData() || '{}').spec.targets;
      const clusterTarget = targets.find((t: { clusterName?: string }) => t.clusterName);

      expect(clusterTarget.clusterName).toBe(DISPLAY_NAME);
    } finally {
      await rancherApi.deleteRancherResource('v1', `fleet.cattle.io.gitrepos/${workspace}`, gitRepoName, false);
    }
  });

  test('resolves metadata.name targets to display name when editing a gitrepo', async ({ page, login, rancherApi }) => {
    const gitRepoName = rancherApi.createE2EResourceName('display-name-edit');

    await rancherApi.createRancherResource(
      'v1',
      'fleet.cattle.io.gitrepos',
      gitRepoTargetAllClustersRequest(workspace, gitRepoName, repoInfo.repoUrl, repoInfo.branch, repoInfo.paths, [
        { clusterName: METADATA_NAME },
      ]),
    );

    await interceptFleetClustersWithDisplayName(page);
    await login();

    const listPage = new FleetApplicationListPagePo(page);
    const header = new HeaderPo(page);

    try {
      await listPage.goTo();
      await listPage.waitForPage();
      await header.selectWorkspace(workspace);

      const actionMenu = await listPage.list().actionMenu(gitRepoName);

      await actionMenu.getMenuItem('Edit Config').click();

      const editPage = new FleetGitRepoCreateEditPo(page, workspace, gitRepoName);

      await editPage.waitForPage('mode=edit');

      // Navigate through wizard steps to reach Target
      await editPage.resourceDetail().createEditView().saveButtonPo().click();
      await expect(editPage.resourceDetail().createEditView().saveButtonPo().self()).toBeVisible();
      await editPage.resourceDetail().createEditView().saveButtonPo().click();

      // Wait for target cluster selector to resolve display name from the intercepted response
      await expect(editPage.targetCluster().selectedOption()).toContainText(DISPLAY_NAME);
    } finally {
      await rancherApi.deleteRancherResource('v1', `fleet.cattle.io.gitrepos/${workspace}`, gitRepoName, false);
    }
  });
});
