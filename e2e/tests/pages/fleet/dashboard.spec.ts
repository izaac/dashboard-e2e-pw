import { test, expect } from '@/support/fixtures';
import { FleetDashboardListPagePo } from '@/e2e/po/pages/fleet/fleet-dashboard.po';
import {
  FleetApplicationCreatePo,
  FleetGitRepoCreateEditPo,
} from '@/e2e/po/pages/fleet/fleet.cattle.io.application.po';
import FleetApplicationDetailsPo from '@/e2e/po/detail/fleet/fleet.cattle.io.application.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import { gitRepoTargetAllClustersRequest } from '@/e2e/blueprints/fleet/gitrepos';

const localWorkspace = 'fleet-local';
const gitRepoUrl = 'https://github.com/rancher/fleet-test-data';
const branch = 'master';
const paths = 'qa-test-apps/nginx-app';

test.describe('Fleet Dashboard', { tag: ['@fleet', '@adminUser', '@jenkins'] }, () => {
  let repoName: string;

  test.beforeEach(async ({ login, rancherApi }) => {
    await login();
    repoName = rancherApi.createE2EResourceName('dash-repo');
  });

  test('Has the correct title', async ({ page, rancherApi }) => {
    const fleetDashboardPage = new FleetDashboardListPagePo(page);

    await fleetDashboardPage.goTo();
    await fleetDashboardPage.waitForPage();

    await expect(fleetDashboardPage.fleetDashboardEmptyState()).toBeVisible();

    const version = await rancherApi.getRancherVersion();
    const expectedTitle =
      version.RancherPrime === 'true'
        ? 'Rancher Prime - Continuous Delivery - Dashboard'
        : 'Rancher - Continuous Delivery - Dashboard';

    await expect(page).toHaveTitle(expectedTitle);
  });

  test('Get Started button takes you to the correct page', async ({ page }) => {
    const fleetDashboardPage = new FleetDashboardListPagePo(page);
    const appBundleCreatePage = new FleetApplicationCreatePo(page);
    const gitRepoCreatePage = new FleetGitRepoCreateEditPo(page);

    await fleetDashboardPage.goTo();
    await fleetDashboardPage.waitForPage();

    await expect(fleetDashboardPage.fleetDashboardEmptyState()).toBeVisible();
    await fleetDashboardPage.getStartedButton().click();

    await appBundleCreatePage.waitForPage();
    await appBundleCreatePage.createGitRepo();

    await gitRepoCreatePage.waitForPage();
    await expect(gitRepoCreatePage.mastheadTitleLocator()).toContainText('App Bundle: Create');
  });

  test('Should display workspace cards', async ({ page, rancherApi }) => {
    await rancherApi.createRancherResource(
      'v1',
      'fleet.cattle.io.gitrepos',
      gitRepoTargetAllClustersRequest(localWorkspace, repoName, gitRepoUrl, branch, paths),
    );

    try {
      const fleetDashboardPage = new FleetDashboardListPagePo(page);
      const burgerMenu = new BurgerMenuPo(page);

      await fleetDashboardPage.goTo();
      await fleetDashboardPage.waitForPage();

      await burgerMenu.checkIfMenuItemLinkIsHighlighted('Continuous Delivery');

      await fleetDashboardPage.viewModeButton().checkVisible();

      const workspaceCard = fleetDashboardPage.workspaceCard(localWorkspace);

      await expect(workspaceCard.expandButton()).toBeVisible();

      const applicationsPanel = workspaceCard.resourcePanel('applications');

      await expect(applicationsPanel.chart()).toBeAttached();
      await expect(applicationsPanel.stateBadge('success')).toBeAttached();
      await expect(applicationsPanel.description()).toContainText('1');

      const clustersPanel = workspaceCard.resourcePanel('clusters');

      await expect(clustersPanel.chart()).toBeAttached();
      await expect(clustersPanel.stateBadge('success')).toBeAttached();
      await expect(clustersPanel.description()).toContainText('1');

      const clusterGroupsPanel = workspaceCard.resourcePanel('cluster-groups');

      await expect(clusterGroupsPanel.self()).toBeAttached();
      await expect(clusterGroupsPanel.chart()).not.toBeAttached();
      await expect(clusterGroupsPanel.stateBadge('success')).toBeAttached();
      await expect(clusterGroupsPanel.description()).toContainText('1');
    } finally {
      await rancherApi.deleteRancherResource('v1', 'fleet.cattle.io.gitrepo', `${localWorkspace}/${repoName}`, false);
    }
  });

  test('Should show workspace cards panel when expanded', async ({ page, rancherApi }) => {
    await rancherApi.createRancherResource(
      'v1',
      'fleet.cattle.io.gitrepos',
      gitRepoTargetAllClustersRequest(localWorkspace, repoName, gitRepoUrl, branch, paths),
    );

    try {
      const fleetDashboardPage = new FleetDashboardListPagePo(page);

      await fleetDashboardPage.goTo();
      await fleetDashboardPage.waitForPage();

      const workspaceCard = fleetDashboardPage.workspaceCard(localWorkspace);

      await expect(workspaceCard.expandButton()).toBeVisible();
      await workspaceCard.expandButton().click();

      const expandedPanel = workspaceCard.expandedPanel();
      const cardsPanel = expandedPanel.cardsPanel();

      await expect(cardsPanel.self()).toBeVisible();

      await expandedPanel.gitReposFilter().checkVisible();
      await expandedPanel.gitReposFilter().isChecked();

      await expandedPanel.helmOpsFilter().checkVisible();
      await expandedPanel.helmOpsFilter().isChecked();

      const activeStatePanel = cardsPanel.statePanel('Active');

      await expect(activeStatePanel.title()).toContainText('Active');
      await expect(activeStatePanel.title()).toContainText('1');
      await expect(activeStatePanel.title()).toContainText('/1');
      await activeStatePanel.title().click();

      await expect(activeStatePanel.card(repoName)).toBeVisible();
    } finally {
      await rancherApi.deleteRancherResource('v1', 'fleet.cattle.io.gitrepo', `${localWorkspace}/${repoName}`, false);
    }
  });

  test('Should filter by GitRepo type', async ({ page, rancherApi }) => {
    await rancherApi.createRancherResource(
      'v1',
      'fleet.cattle.io.gitrepos',
      gitRepoTargetAllClustersRequest(localWorkspace, repoName, gitRepoUrl, branch, paths),
    );

    try {
      const fleetDashboardPage = new FleetDashboardListPagePo(page);

      await fleetDashboardPage.goTo();
      await fleetDashboardPage.waitForPage();

      const workspaceCard = fleetDashboardPage.workspaceCard(localWorkspace);

      await workspaceCard.expandButton().click();

      const expandedPanel = workspaceCard.expandedPanel();
      const cardsPanel = expandedPanel.cardsPanel();

      await expandedPanel.gitReposFilter().set();
      const activeStatePanel = cardsPanel.statePanel('Active');

      await expect(activeStatePanel.self()).toBeHidden();
    } finally {
      await rancherApi.deleteRancherResource('v1', 'fleet.cattle.io.gitrepo', `${localWorkspace}/${repoName}`, false);
    }
  });

  test('Should change ViewMode', async ({ page, rancherApi }) => {
    await rancherApi.createRancherResource(
      'v1',
      'fleet.cattle.io.gitrepos',
      gitRepoTargetAllClustersRequest(localWorkspace, repoName, gitRepoUrl, branch, paths),
    );

    try {
      const fleetDashboardPage = new FleetDashboardListPagePo(page);

      await fleetDashboardPage.goTo();
      await fleetDashboardPage.waitForPage();

      const workspaceCard = fleetDashboardPage.workspaceCard(localWorkspace);

      await workspaceCard.expandButton().click();

      const cardsPanel = workspaceCard.expandedPanel().cardsPanel();

      await expect(cardsPanel.self()).toBeVisible();

      await fleetDashboardPage.viewModeButton().selectByIndex(0);

      await cardsPanel.checkNotExists();

      const tablePanel = workspaceCard.expandedPanel().tablePanel();

      await tablePanel.checkVisible();
    } finally {
      await rancherApi.deleteRancherResource('v1', 'fleet.cattle.io.gitrepo', `${localWorkspace}/${repoName}`, false);
    }
  });

  test('Should open slide-in panel', async ({ page, rancherApi }) => {
    await rancherApi.createRancherResource(
      'v1',
      'fleet.cattle.io.gitrepos',
      gitRepoTargetAllClustersRequest(localWorkspace, repoName, gitRepoUrl, branch, paths),
    );

    try {
      const fleetDashboardPage = new FleetDashboardListPagePo(page);

      await fleetDashboardPage.goTo();
      await fleetDashboardPage.waitForPage();

      const workspaceCard = fleetDashboardPage.workspaceCard(localWorkspace);

      await workspaceCard.expandButton().click();

      const cardsPanel = workspaceCard.expandedPanel().cardsPanel();
      const activeStatePanel = cardsPanel.statePanel('Active');

      await activeStatePanel.title().click();
      await activeStatePanel.card(repoName).click();

      const details = fleetDashboardPage.slideInPanel();

      await expect(details).toBeVisible();
      await expect(details).toContainText(repoName);
    } finally {
      await rancherApi.deleteRancherResource('v1', 'fleet.cattle.io.gitrepo', `${localWorkspace}/${repoName}`, false);
    }
  });

  test('Should navigate to App Bundles details page from Fleet Dashboard', async ({ page, rancherApi }) => {
    await rancherApi.createRancherResource(
      'v1',
      'fleet.cattle.io.gitrepos',
      gitRepoTargetAllClustersRequest(localWorkspace, repoName, gitRepoUrl, branch, paths),
    );

    try {
      const fleetDashboardPage = new FleetDashboardListPagePo(page);
      const appDetails = new FleetApplicationDetailsPo(page, localWorkspace, repoName, 'fleet.cattle.io.gitrepo');

      await fleetDashboardPage.goTo();
      await fleetDashboardPage.waitForPage();

      const workspaceCard = fleetDashboardPage.workspaceCard(localWorkspace);

      await workspaceCard.expandButton().click();

      const cardsPanel = workspaceCard.expandedPanel().cardsPanel();
      const activeStatePanel = cardsPanel.statePanel('Active');

      await activeStatePanel.title().click();
      await expect(activeStatePanel.card(repoName)).toBeVisible();
      await activeStatePanel.card(repoName).click();

      const details = fleetDashboardPage.slideInPanel();

      await expect(details).toBeVisible();
      await fleetDashboardPage.slideInPanelTitleLink(repoName).click();

      await appDetails.waitForPage(undefined, 'bundles');
    } finally {
      await rancherApi.deleteRancherResource('v1', 'fleet.cattle.io.gitrepo', `${localWorkspace}/${repoName}`, false);
    }
  });
});
