import { test, expect } from '@/support/fixtures';
import { FleetClusterListPagePo, FleetClusterDetailsPo } from '@/e2e/po/pages/fleet/fleet.cattle.io.cluster.po';
import {
  FleetApplicationListPagePo,
  FleetGitRepoCreateEditPo,
  FleetApplicationCreatePo,
} from '@/e2e/po/pages/fleet/fleet.cattle.io.application.po';
import { gitRepoTargetAllClustersRequest } from '@/e2e/blueprints/fleet/gitrepos';
import { HeaderPo } from '@/e2e/po/components/header.po';

/**
 * Fleet Clusters spec — converted from upstream fleet/fleet-clusters.spec.ts.
 *
 * The first describe block ('bundle manifests are deployed from BundleDeployment
 * into the downstream cluster') requires an AWS-provisioned RKE2 cluster and is
 * fully skipped. The 'resources' describe block includes tests that work against
 * the local cluster only and are converted properly.
 */

const gitRepoUrl = 'https://github.com/rancher/fleet-test-data';
const branch = 'master';
const paths = 'qa-test-apps/nginx-app';

test.describe(
  'Fleet Clusters - bundle manifests are deployed from the BundleDeployment into the downstream cluster',
  {
    tag: ['@fleet', '@adminUser', '@jenkins'],
  },
  () => {
    test.beforeEach(async () => {
      test.skip(true, 'Requires downstream clusters — needs AWS-provisioned RKE2 cluster with fleet agent');
    });

    test('data is populated in fleet cluster list and detail view', async () => {
      // Requires: real downstream cluster provisioned via AWS RKE2
    });

    test('check all tabs are available in the details view', async () => {
      // Requires: real downstream cluster provisioned via AWS RKE2
    });

    test('adding git repo should add bundles on downstream cluster (deployments added)', async () => {
      // Requires: real downstream cluster provisioned via AWS RKE2
    });

    test('can Pause', async () => {
      // Requires: real downstream cluster provisioned via AWS RKE2
    });

    test('can Unpause', async () => {
      // Requires: real downstream cluster provisioned via AWS RKE2
    });

    test('can Edit Config', async () => {
      // Requires: real downstream cluster provisioned via AWS RKE2
    });

    test('can Download YAML', async () => {
      // Requires: real downstream cluster provisioned via AWS RKE2
    });

    test('can assign cluster to different fleet workspaces', async () => {
      // Requires: real downstream cluster provisioned via AWS RKE2 + provisioningv2-fleet-workspace-back-population feature flag
    });

    test('removing git repo should remove bundles on downstream cluster (deployments removed)', async () => {
      // Requires: real downstream cluster provisioned via AWS RKE2
    });

    test('cluster should be removed from fleet cluster list once deleted', async () => {
      // Requires: real downstream cluster provisioned via AWS RKE2
    });
  },
);

test.describe('Fleet Cluster List - resources', { tag: ['@fleet', '@adminUser'] }, () => {
  const workspace = 'fleet-local';

  test('should display fleet clusters list page', async ({ page, login }) => {
    await login();

    const fleetClusterListPage = new FleetClusterListPagePo(page);
    const header = new HeaderPo(page);

    await fleetClusterListPage.goTo();
    await fleetClusterListPage.waitForPage();
    await header.selectWorkspace(workspace);

    await fleetClusterListPage.sortableTable().checkLoadingIndicatorNotVisible();

    await expect(fleetClusterListPage.mainRows()).toHaveCount(1);
  });

  test('should be able to list clusters in local workspace', async ({ page, login }) => {
    await login();

    const fleetClusterListPage = new FleetClusterListPagePo(page);
    const header = new HeaderPo(page);

    await fleetClusterListPage.goTo();
    await fleetClusterListPage.waitForPage();
    await header.selectWorkspace(workspace);

    await fleetClusterListPage.sortableTable().checkLoadingIndicatorNotVisible();

    await expect(fleetClusterListPage.mainRows()).toHaveCount(1);
  });

  test('Git Repos Tab Add Repository button takes you to the correct page', async ({ page, login }) => {
    await login();

    const fleetClusterListPage = new FleetClusterListPagePo(page);
    const header = new HeaderPo(page);
    const appBundleCreatePage = new FleetApplicationCreatePo(page);
    const gitRepoCreatePage = new FleetGitRepoCreateEditPo(page);

    await fleetClusterListPage.goTo();
    await fleetClusterListPage.waitForPage();
    await header.selectWorkspace(workspace);

    await fleetClusterListPage.sortableTable().checkLoadingIndicatorNotVisible();
    await fleetClusterListPage.goToDetailsPage('local');

    const fleetClusterDetailsPage = new FleetClusterDetailsPo(page, workspace, 'local');

    await fleetClusterDetailsPage.waitForPage(undefined, 'applications');
    await fleetClusterDetailsPage.addAppButton().click();
    await appBundleCreatePage.waitForPage();

    await appBundleCreatePage.createGitRepo();
    await gitRepoCreatePage.waitForPage();

    await expect(gitRepoCreatePage.mastheadTitleLocator()).toContainText('App Bundle: Create');
  });

  test('should only display action menu with allowed actions only', async ({ page, login }) => {
    await login();

    const fleetClusterListPage = new FleetClusterListPagePo(page);
    const header = new HeaderPo(page);

    await fleetClusterListPage.goTo();
    await fleetClusterListPage.waitForPage();
    await header.selectWorkspace(workspace);

    await fleetClusterListPage.sortableTable().checkVisible();
    await fleetClusterListPage.sortableTable().checkLoadingIndicatorNotVisible();

    const actionMenu = await fleetClusterListPage.list().actionMenu('local');

    await expect(actionMenu.getMenuItem('Pause')).toBeAttached();
    await expect(actionMenu.getMenuItem('Force Update')).toBeAttached();
    await expect(actionMenu.getMenuItem('Edit YAML')).toBeAttached();
    await expect(actionMenu.getMenuItem('Edit Config')).toBeAttached();

    // 'Change workspace' should NOT be available for the local cluster
    await expect(actionMenu.getMenuItem('Change workspace')).not.toBeAttached();
  });

  test(
    'check table headers are available in list and details view',
    { tag: ['@noVai', '@adminUser'] },
    async ({ page, login, rancherApi }) => {
      const gitRepoName = rancherApi.createE2EResourceName('git-repo');
      const fleetClusterListPage = new FleetClusterListPagePo(page);
      const fleetAppBundlesListPage = new FleetApplicationListPagePo(page);
      const header = new HeaderPo(page);

      await login();

      await rancherApi.createRancherResource(
        'v1',
        'fleet.cattle.io.gitrepos',
        gitRepoTargetAllClustersRequest(workspace, gitRepoName, gitRepoUrl, branch, paths),
      );

      try {
        await fleetAppBundlesListPage.goTo();
        await fleetAppBundlesListPage.waitForPage();
        await header.selectWorkspace(workspace);
        await expect(fleetAppBundlesListPage.sortableTable().rowElementWithName(gitRepoName)).toBeVisible();

        await fleetClusterListPage.goTo();
        await fleetClusterListPage.waitForPage();
        await header.selectWorkspace(workspace);

        await fleetClusterListPage.sortableTable().checkLoadingIndicatorNotVisible();

        const expectedHeaders = [
          'State',
          'Name',
          'Git Repos Ready',
          'Helm Ops Ready',
          'Bundles Ready',
          'Resources',
          'Last Seen',
          'Age',
        ];

        await expect(fleetClusterListPage.sortableTable().self()).toBeVisible();
        const actualHeaders = await fleetClusterListPage.sortableTable().headerNames();

        expect(actualHeaders).toEqual(expectedHeaders);

        await fleetClusterListPage.goToDetailsPage('local');

        const fleetClusterDetailsPage = new FleetClusterDetailsPo(page, workspace, 'local');

        await fleetClusterDetailsPage.waitForPage(undefined, 'applications');

        const expectedHeadersDetailsView = [
          'State',
          'Name',
          'Type',
          'Source',
          'Target',
          'Clusters Ready',
          'Resources',
          'Age',
        ];
        const detailsTable = fleetClusterDetailsPage.appBundlesList();

        await detailsTable.checkVisible();
        await detailsTable.checkLoadingIndicatorNotVisible();
        await detailsTable.groupByButtons(0).click();

        const actualHeadersDetailsView = await detailsTable.headerNames();

        expect(actualHeadersDetailsView).toEqual(expectedHeadersDetailsView);
      } finally {
        await rancherApi.deleteRancherResource('v1', `fleet.cattle.io.gitrepos/${workspace}`, gitRepoName, false);
      }
    },
  );
});
