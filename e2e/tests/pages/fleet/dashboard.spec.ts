import { test, expect } from '@/support/fixtures';
import { FleetDashboardListPagePo } from '@/e2e/po/pages/fleet/fleet-dashboard.po';
import {
  FleetApplicationCreatePo,
  FleetGitRepoCreateEditPo,
} from '@/e2e/po/pages/fleet/fleet.cattle.io.application.po';
import FleetApplicationDetailsPo from '@/e2e/po/detail/fleet/fleet.cattle.io.application.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import { gitRepoTargetAllClustersRequest } from '@/e2e/blueprints/fleet/gitrepos';
import { MEDIUM_TIMEOUT_OPT, POLL_INTERVAL } from '@/support/timeouts';

const localWorkspace = 'fleet-local';
const gitRepoUrl = 'https://github.com/rancher/fleet-test-data';
const branch = 'master';
const paths = 'qa-test-apps/nginx-app';

test.describe('Fleet Dashboard', { tag: ['@fleet', '@adminUser', '@jenkins'] }, () => {
  let repoName: string;

  test.beforeEach(async ({ login, rancherApi }) => {
    await login();
    repoName = rancherApi.createE2EResourceName('dash-repo');
    // Idempotent: remove leftover from previous failed runs
    await rancherApi.deleteRancherResource('v1', 'fleet.cattle.io.gitrepo', `${localWorkspace}/${repoName}`, false);
    // Wait for deletion to fully complete (fleet gitrepos are async)
    await rancherApi.waitForRancherResource(
      'v1',
      'fleet.cattle.io.gitrepo',
      `${localWorkspace}/${repoName}`,
      (resp) => resp.status === 404,
      15,
      POLL_INTERVAL,
    );
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

      await expect(burgerMenu.menuItemWrapper('Continuous Delivery')).toHaveClass(/active-menu-link/);

      await expect(fleetDashboardPage.viewModeButton().self()).toBeVisible();

      const workspaceCard = fleetDashboardPage.workspaceCard(localWorkspace);

      await expect(workspaceCard.expandButton()).toBeVisible();

      const applicationsPanel = workspaceCard.resourcePanel('applications');

      await expect(applicationsPanel.chart()).toBeAttached(MEDIUM_TIMEOUT_OPT);
      await expect(applicationsPanel.stateBadge('success')).toBeAttached();
      await expect(applicationsPanel.description()).toContainText('1');

      const clustersPanel = workspaceCard.resourcePanel('clusters');

      await expect(clustersPanel.chart()).toBeAttached(MEDIUM_TIMEOUT_OPT);
      await expect(clustersPanel.stateBadge()).toBeAttached(MEDIUM_TIMEOUT_OPT);
      await expect(clustersPanel.description()).toContainText('1');

      const clusterGroupsPanel = workspaceCard.resourcePanel('cluster-groups');

      await expect(clusterGroupsPanel.self()).toBeAttached(MEDIUM_TIMEOUT_OPT);
      await expect(clusterGroupsPanel.chart()).not.toBeAttached();
      await expect(clusterGroupsPanel.stateBadge()).toBeAttached();
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

      await expect(expandedPanel.gitReposFilter().self()).toBeVisible();
      await expect(expandedPanel.gitReposFilter().checkboxCustom()).toHaveAttribute('aria-checked', 'true');

      await expect(expandedPanel.helmOpsFilter().self()).toBeVisible();
      await expect(expandedPanel.helmOpsFilter().checkboxCustom()).toHaveAttribute('aria-checked', 'true');

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

      await expect(cardsPanel.self()).not.toBeAttached();

      const tablePanel = workspaceCard.expandedPanel().tablePanel();

      await expect(tablePanel.self()).toBeVisible();
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

      // GitRepo may still be progressing — wait for Active panel to appear
      await expect(activeStatePanel.title()).toBeVisible(MEDIUM_TIMEOUT_OPT);
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
