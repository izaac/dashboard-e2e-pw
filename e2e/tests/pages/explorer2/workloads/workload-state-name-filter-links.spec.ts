import { errors, type Page } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import WorkloadDashboardPagePo from '@/e2e/po/pages/explorer/workloads/workload-dashboard.po';
import { WorkloadsPodsListPagePo } from '@/e2e/po/pages/explorer/workloads-pods.po';
import WorkloadSearchPo from '@/e2e/po/components/workload-search.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';
import { getFeatureFlagValue, setFeatureFlagValue } from '@/support/utils/feature-flag';

/**
 * rancher/dashboard#19527 (fix PR #19534): with the ui-configurable-tables feature flag off, links that open a list
 * for some of its states (Workloads Overview) or for a name (Workloads Overview search "+ N more") list only those
 * states or names and say so in a bar with a Clear filter link. With the flag on the state or name goes into the
 * table search bar instead. Cert-manager buckets use the same links but need cert-manager installed, so they are
 * not covered here.
 */
test.describe('Workload links to state and name filtered lists (#19527)', { tag: ['@explorer2', '@adminUser'] }, () => {
  const FLAG = 'ui-configurable-tables';
  const IMAGE = 'busybox:1.36';
  /** Pods the Workloads Overview search lists per type before it shows a "+ N more" row */
  const SEARCH_RESULTS_PER_TYPE = 7;
  const RUNNING_COUNT = SEARCH_RESULTS_PER_TYPE + 2;
  const COMPLETED_COUNT = 2;
  const TOTAL_COUNT = RUNNING_COUNT + COMPLETED_COUNT;
  const POD_READY_RETRIES = 60;
  const POD_READY_DELAY = 2_000;

  const stamp = Date.now();
  const nsName = `e2e-19527-${stamp}`;
  const runningPods = Array.from({ length: RUNNING_COUNT }, (_, i) => `sf${stamp}-run-${i + 1}`);
  const completedPods = Array.from({ length: COMPLETED_COUNT }, (_, i) => `sf${stamp}-done-${i + 1}`);
  /** Matches every running pod and no completed one */
  const RUNNING_SEARCH_TERM = `sf${stamp}-run`;

  let originalFlag: boolean | null = null;
  let originalNsFilter: string | undefined;
  let originalGroupBy: string | undefined;
  let originalTableViews: string | undefined;

  function podBody(name: string, completes: boolean) {
    return {
      type: 'pod',
      metadata: { name, namespace: nsName },
      spec: {
        restartPolicy: completes ? 'Never' : 'Always',
        terminationGracePeriodSeconds: 0,
        containers: [{ name: 'container-0', image: IMAGE, command: completes ? ['true'] : ['sleep', '86400'] }],
      },
    };
  }

  async function createPodsAndWait(rancherApi: RancherApi, names: string[], completes: boolean) {
    for (const name of names) {
      await rancherApi.createRancherResource('v1', 'pods', podBody(name, completes));
    }

    const expectedState = completes ? 'completed' : 'running';

    for (const name of names) {
      await rancherApi.expectResourceState(
        'v1',
        'pods',
        `${nsName}/${name}`,
        (resp) => resp.body.metadata?.state?.name === expectedState,
        POD_READY_RETRIES,
        POD_READY_DELAY,
      );
    }
  }

  /** The Prime welcome dialog mounts a moment after the page renders, and only on Prime builds */
  async function dismissWelcomeDialog(page: Page): Promise<void> {
    const welcome = new WelcomeDialogPo(page);

    try {
      await welcome.self().waitFor({ state: 'visible', timeout: 5000 });
    } catch (e) {
      if (!(e instanceof errors.TimeoutError)) {
        throw e;
      }

      return;
    }

    await welcome.dismissIfVisible();
  }

  /** Sets the flag, then loads the Workloads Overview afresh so the app starts with that flag value */
  async function openWorkloadOverview(
    page: Page,
    rancherApi: RancherApi,
    flag: boolean,
  ): Promise<WorkloadDashboardPagePo> {
    await setFeatureFlagValue(rancherApi, FLAG, flag);

    const dashboard = new WorkloadDashboardPagePo(page);

    await dashboard.goTo();
    await dismissWelcomeDialog(page);
    await expect(dashboard.byTypeCard('Pods')).toBeVisible();

    return dashboard;
  }

  test.beforeAll(async ({ rancherApi }) => {
    const prefs = (await rancherApi.getRancherResource('v1', 'userpreferences')).body.data[0]?.data;

    originalFlag = await getFeatureFlagValue(rancherApi, FLAG);
    originalNsFilter = prefs?.['ns-by-cluster'];
    originalGroupBy = prefs?.['group-by'];
    originalTableViews = prefs?.['table-views'];

    await rancherApi.createNamespace(nsName);
    await createPodsAndWait(rancherApi, runningPods, false);
    await createPodsAndWait(rancherApi, completedPods, true);
  });

  test.afterAll(async ({ rancherApi }) => {
    await setFeatureFlagValue(rancherApi, FLAG, originalFlag);
    await rancherApi.setUserPreference({
      'ns-by-cluster': originalNsFilter ?? '{"local":["all://user"]}',
      'group-by': originalGroupBy ?? 'none',
      'table-views': originalTableViews ?? '{}',
    });
    await rancherApi.deleteNamespace([nsName]);
  });

  test.beforeEach(async ({ page, login, rancherApi }) => {
    await login();

    // Drop the login page before pinning: the UI saves the whole preference document a few seconds into a page
    // load, and that write would otherwise land on top of the filter below, leaving the list unscoped.
    await page.goto('about:blank');

    // Only the pods of this spec are in scope, ungrouped, and no saved table views get in the way
    await rancherApi.setUserPreference({
      'ns-by-cluster': JSON.stringify({ local: [`ns://${nsName}`] }),
      'group-by': 'none',
      'table-views': '{}',
    });
  });

  test('flag off: the Completed link lists only completed pods under a State filter applied bar', async ({
    page,
    rancherApi,
  }) => {
    const dashboard = await openWorkloadOverview(page, rancherApi, false);
    const pods = new WorkloadsPodsListPagePo(page);
    const filters = pods.waitForListRequestFilters('metadata.state.name', ['metadata.state.name IN (completed)']);

    await dashboard.byTypeStateLink('Pods', 'Completed').click();

    expect(await filters).toContain('metadata.state.name IN (completed)');
    await expect(pods.stateFilterBar()).toContainText('Completed');
    await expect(pods.sortableTable().rowElements()).toHaveCount(COMPLETED_COUNT);

    for (const name of completedPods) {
      await expect(pods.sortableTable().rowWithName(name).self()).toBeVisible();
    }

    await expect(pods.sortableTable().rowWithName(runningPods[0]).self()).toBeHidden();
  });

  test('flag off: Clear filter restores the whole list and the state param, and Back filters again', async ({
    page,
    rancherApi,
  }) => {
    const dashboard = await openWorkloadOverview(page, rancherApi, false);
    const pods = new WorkloadsPodsListPagePo(page);

    await dashboard.byTypeStateLink('Pods', 'Completed').click();
    await expect(pods.stateFilterBar()).toBeVisible();
    await expect(pods.sortableTable().rowElements()).toHaveCount(COMPLETED_COUNT);
    await expect(page).toHaveURL(/stateFilter=completed/);

    await pods.clearStateFilter();

    await expect(pods.stateFilterBar()).toHaveCount(0);
    await expect(page).not.toHaveURL(/stateFilter/);
    await expect(pods.sortableTable().rowElements()).toHaveCount(TOTAL_COUNT);

    await page.goBack();

    await expect(page).toHaveURL(/stateFilter=completed/);
    await expect(pods.stateFilterBar()).toContainText('Completed');
    await expect(pods.sortableTable().rowElements()).toHaveCount(COMPLETED_COUNT);
  });

  test('flag off: an address with several states lists pods in all of them', async ({ page, rancherApi }) => {
    await setFeatureFlagValue(rancherApi, FLAG, false);

    const pods = new WorkloadsPodsListPagePo(page);
    const filters = pods.waitForListRequestFilters('metadata.state.name', [
      'metadata.state.name IN (completed,running)',
    ]);

    await pods.goTo('stateFilter=completed,running');
    await dismissWelcomeDialog(page);

    expect(await filters).toContain('metadata.state.name IN (completed,running)');
    await expect(pods.stateFilterBar()).toContainText('Completed');
    await expect(pods.stateFilterBar()).toContainText('Running');
    await expect(pods.sortableTable().rowElements()).toHaveCount(TOTAL_COUNT);
    await expect(pods.sortableTable().rowWithName(completedPods[0]).self()).toBeVisible();
    await expect(pods.sortableTable().rowWithName(runningPods[0]).self()).toBeVisible();
  });

  test('flag off: the search "+ N more" row lists pods by name under a Name filter applied bar', async ({
    page,
    rancherApi,
  }) => {
    await openWorkloadOverview(page, rancherApi, false);

    const search = new WorkloadSearchPo(page);
    const pods = new WorkloadsPodsListPagePo(page);

    await search.search(RUNNING_SEARCH_TERM);
    await expect(search.showMoreLink('Pods')).toBeVisible();

    const filters = pods.waitForListRequestFilters('metadata.name', [`metadata.name~"${RUNNING_SEARCH_TERM}"`]);

    await search.showMoreLink('Pods').click();

    expect((await filters).join(' ')).toContain(`metadata.name~"${RUNNING_SEARCH_TERM}"`);
    await expect(pods.nameFilterBar()).toContainText(RUNNING_SEARCH_TERM);
    await expect(pods.sortableTable().rowElements()).toHaveCount(RUNNING_COUNT);
    await expect(pods.sortableTable().rowWithName(completedPods[0]).self()).toBeHidden();

    await pods.clearNameFilter();

    await expect(pods.nameFilterBar()).toHaveCount(0);
    await expect(page).not.toHaveURL(/nameFilter/);
    await expect(pods.sortableTable().rowElements()).toHaveCount(TOTAL_COUNT);
  });

  test('flag on: the Completed link puts the state in the search bar and shows no old bar', async ({
    page,
    rancherApi,
  }) => {
    const dashboard = await openWorkloadOverview(page, rancherApi, true);
    const pods = new WorkloadsPodsListPagePo(page);

    await dashboard.byTypeStateLink('Pods', 'Completed').click();

    await expect(pods.tableViews().searchInput()).toContainText('state:completed');
    await expect(pods.sortableTable().rowElements()).toHaveCount(COMPLETED_COUNT);
    await expect(pods.stateFilterBar()).toHaveCount(0);
  });

  test('flag on: the search "+ N more" row puts the name in the search bar and shows no old bar', async ({
    page,
    rancherApi,
  }) => {
    await openWorkloadOverview(page, rancherApi, true);

    const search = new WorkloadSearchPo(page);
    const pods = new WorkloadsPodsListPagePo(page);

    await search.search(RUNNING_SEARCH_TERM);
    await search.showMoreLink('Pods').click();

    await expect(pods.tableViews().searchInput()).toContainText(`name:${RUNNING_SEARCH_TERM}`);
    await expect(pods.sortableTable().rowElements()).toHaveCount(RUNNING_COUNT);
    await expect(pods.nameFilterBar()).toHaveCount(0);
  });
});
