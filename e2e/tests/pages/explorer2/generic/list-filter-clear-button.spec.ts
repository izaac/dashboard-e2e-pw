import { test, expect } from '@/support/fixtures';
import { WorkloadsDeploymentsListPagePo } from '@/e2e/po/pages/explorer/workloads/workloads-deployments.po';
import LicensesPagePo from '@/e2e/po/pages/licenses.po';
import { HeaderPo } from '@/e2e/po/components/header.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';
import { createDeploymentBlueprint } from '@/e2e/blueprints/explorer/workloads/deployments/deployment-create';
import {
  setTablePreferences,
  restoreTablePreferences,
  type SavedPrefs,
} from '@/e2e/tests/pages/explorer2/workloads/pagination.utils';
import { BRIEF, LONG } from '@/support/timeouts';

const FILTER_TEXT = 'nginx';

/** A replica-less deployment whose name and container carry no text other than the given name */
function deploymentFor(namespace: string, name: string) {
  const labels = { 'workload.user.cattle.io/workloadselector': `apps.deployment-${name}` };

  return {
    ...createDeploymentBlueprint,
    metadata: { ...createDeploymentBlueprint.metadata, name, namespace, labels },
    spec: {
      replicas: 0,
      selector: { matchLabels: labels },
      template: {
        metadata: { labels },
        spec: { containers: [{ name: 'pause', image: 'k8s.gcr.io/pause' }] },
      },
    },
  };
}

test.describe('List Filter Clear Button (#11342)', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.describe('Table views filter on Workloads > Deployments', () => {
    const nsName = `e2e-clearfilter-${Date.now()}`;
    const matchingName = `nginx-${Date.now()}`;
    const otherNames = [`redis-${Date.now()}`, `postgres-${Date.now()}`];
    const deploymentNames = [matchingName, ...otherNames];

    let originalTableViews: string | undefined;
    let savedPrefs: SavedPrefs;

    test.beforeAll(async ({ rancherApi }) => {
      // Saved views live in the user's preferences: remember what was there so it can be put back
      const prefs = await rancherApi.getRancherResource('v1', 'userpreferences');

      originalTableViews = prefs.body.data[0]?.data?.['table-views'];

      await rancherApi.createNamespace(nsName);

      for (const name of deploymentNames) {
        await rancherApi.createRancherResource('v1', 'apps.deployments', deploymentFor(nsName, name));
      }

      // Only the new namespace is listed, with no grouping, so the row counts below are exact
      savedPrefs = await setTablePreferences(rancherApi, [nsName]);
      await rancherApi.setUserPreference({ 'table-views': '{}' });
    });

    test.afterAll(async ({ rancherApi }) => {
      try {
        if (savedPrefs) {
          await restoreTablePreferences(rancherApi, savedPrefs);
        }
        await rancherApi.setUserPreference({ 'table-views': originalTableViews ?? '{}' });
      } finally {
        for (const name of deploymentNames) {
          await rancherApi.deleteRancherResource('v1', 'apps.deployments', `${nsName}/${name}`, false);
        }

        await rancherApi.deleteNamespace([nsName]);
      }
    });

    test.beforeEach(async ({ login, page }) => {
      await login();

      const deployments = new WorkloadsDeploymentsListPagePo(page);

      await deployments.goTo();
      await new WelcomeDialogPo(page).dismissIfVisible();
      await deployments.sortableTable().waitFor({ state: 'visible', timeout: LONG });

      const tableViews = deployments.tableViews();

      await tableViews
        .searchInput()
        .waitFor({ state: 'visible', timeout: BRIEF })
        .catch(() => {});

      test.skip(!(await tableViews.searchInput().isVisible()), 'table views filter not present in this build');

      await expect(deployments.sortableTablePo().rowElements()).toHaveCount(deploymentNames.length, { timeout: LONG });
    });

    test('clear button is visible while the table views filter has text and focus', async ({ page }) => {
      const tableViews = new WorkloadsDeploymentsListPagePo(page).tableViews();

      await tableViews.typeQuery(FILTER_TEXT);

      await expect(tableViews.searchInput()).toBeFocused();
      await expect(tableViews.searchClearButton()).toBeVisible();
    });

    test('clear button and filter text stay after focus leaves the filter', async ({ page }) => {
      const deployments = new WorkloadsDeploymentsListPagePo(page);
      const tableViews = deployments.tableViews();

      await tableViews.typeQuery(FILTER_TEXT);
      await expect(tableViews.searchClearButton()).toBeVisible();

      await tableViews.blurQuery();

      await expect(tableViews.searchInput()).not.toBeFocused();
      await expect(tableViews.searchInput()).toHaveText(FILTER_TEXT);
      await expect(tableViews.searchClearButton()).toBeVisible();

      // The list is still filtered: only the matching deployment remains
      await expect(deployments.listElementWithName(matchingName)).toBeVisible();

      for (const name of otherNames) {
        await expect(deployments.listElementWithName(name)).toHaveCount(0);
      }

      await expect(deployments.sortableTablePo().rowElements()).toHaveCount(1);
    });

    test('clicking clear empties the table views filter and restores the full list', async ({ page }) => {
      const deployments = new WorkloadsDeploymentsListPagePo(page);
      const tableViews = deployments.tableViews();
      const table = deployments.sortableTablePo();
      const unfilteredCount = await table.rowCount();

      expect(unfilteredCount).toBe(deploymentNames.length);

      await tableViews.typeQuery(FILTER_TEXT);
      await tableViews.blurQuery();
      await expect(table.rowElements()).toHaveCount(1);

      await tableViews.searchClearButton().click();

      await expect(tableViews.searchInput()).toBeEmpty();
      await expect(tableViews.searchClearButton()).toBeHidden();
      await expect.poll(() => table.rowCount(), { timeout: LONG }).toBe(unfilteredCount);
    });
  });

  test.describe('Legacy search box on About > Licenses', () => {
    test.beforeEach(async ({ login, page }) => {
      await login();
      await new WelcomeDialogPo(page).dismissIfVisible();
    });

    test('legacy search box clear button persists after blur and clears the filter (Licenses)', async ({ page }) => {
      const licensesPage = new LicensesPagePo(page);

      await licensesPage.goTo();
      await licensesPage.waitForPage();
      await expect(licensesPage.packageLinks().first()).toBeVisible({ timeout: LONG });

      await licensesPage.searchInput().fill('jszip');
      await expect(licensesPage.legacyClearButton()).toBeVisible();

      await new HeaderPo(page).clickInertCorner();

      await expect(licensesPage.searchInput()).not.toBeFocused();
      await expect(licensesPage.searchInput()).toHaveValue('jszip');
      await expect(licensesPage.legacyClearButton()).toBeVisible();

      await licensesPage.legacyClearButton().click();

      await expect(licensesPage.searchInput()).toHaveValue('');
      await expect.poll(() => licensesPage.packageLinks().count(), { timeout: LONG }).toBeGreaterThan(1);
    });
  });
});
