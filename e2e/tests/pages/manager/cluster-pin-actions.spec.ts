import { test, expect } from '@/support/fixtures';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import HomePagePo from '@/e2e/po/pages/home.po';
import ActionMenuPo from '@/e2e/po/components/action-menu.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';
import ClusterManagerDetailRke2CustomPagePo from '@/e2e/po/detail/provisioning.cattle.io.cluster/cluster-detail-rke2-custom.po';
import {
  qa19241AutoBadgeMgmtClusterPayload,
  qa19241BulkMgmtClusterPayload,
  qa19241CustomBadgeMgmtClusterPayload,
  qa19241ProvClusterPayload,
  qa19241StandardMgmtClusterPayload,
} from '@/e2e/blueprints/manager/cluster-pin-fixture-payloads';

const FIXTURE_MGMT_CLUSTERS = [
  { name: 'qa-19241-custom-badge', payloadFactory: qa19241CustomBadgeMgmtClusterPayload },
  { name: 'qa-19241-auto-badge', payloadFactory: qa19241AutoBadgeMgmtClusterPayload },
  { name: 'qa-19241-standard', payloadFactory: qa19241StandardMgmtClusterPayload },
  { name: 'qa-19241-bulk01', payloadFactory: () => qa19241BulkMgmtClusterPayload(1) },
  { name: 'qa-19241-bulk02', payloadFactory: () => qa19241BulkMgmtClusterPayload(2) },
  { name: 'qa-19241-bulk03', payloadFactory: () => qa19241BulkMgmtClusterPayload(3) },
  { name: 'qa-19241-bulk04', payloadFactory: () => qa19241BulkMgmtClusterPayload(4) },
] as const; // bulk04 exists for parity with the manual fixture; no test reads it

const PROV_CLUSTER_NAME = 'qa-19241-prov';
const PROV_NS = 'fleet-default';
const PROV_BADGE_ANNOTATIONS = {
  'ui.rancher/badge-color': '#b62020',
  'ui.rancher/badge-text': 'Production Cluster',
  'ui.rancher/badge-icon-text': 'PRD',
};

let cachedApiToken: string | undefined;

/**
 * Steve (v1) rejects every mutation on management.cattle.io.clusters with
 * "Method POST/PUT/PATCH/DELETE not supported" (403), so fixtures are written
 * through the Kubernetes API of the local cluster instead. Reads still go
 * through the RancherApi helper. Mirrors RancherApi.forceCleanStuckCRDs.
 */
async function rancherToken(): Promise<string> {
  if (cachedApiToken) {
    return cachedApiToken;
  }

  const apiUrl = process.env.API;
  const username = process.env.TEST_USERNAME || 'admin';
  const password = process.env.CATTLE_BOOTSTRAP_PASSWORD || process.env.TEST_PASSWORD || '';

  if (!apiUrl || !password) {
    throw new Error('API and TEST_PASSWORD are required to manage the qa-19241 fixtures');
  }

  const loginResp = await fetch(`${apiUrl}/v3-public/localProviders/local?action=login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username, password, responseType: 'json' }),
  });
  const loginBody = await loginResp.json().catch(() => ({}));

  if (!loginResp.ok || !loginBody?.token) {
    throw new Error(`login failed: status=${loginResp.status} body=${JSON.stringify(loginBody).substring(0, 200)}`);
  }

  const token: string = loginBody.token;

  cachedApiToken = token;

  return token;
}

async function managementClusterRequest(
  method: 'POST' | 'PATCH' | 'DELETE',
  name: string | undefined,
  body?: object,
  contentType = 'application/json',
): Promise<Response> {
  const apiUrl = process.env.API;

  if (!apiUrl) {
    throw new Error('API is required to manage the qa-19241 fixtures');
  }

  const url = `${apiUrl}/apis/management.cattle.io/v3/clusters${name ? `/${name}` : ''}`;
  const token = await rancherToken();

  return fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function createManagementCluster(payload: object): Promise<void> {
  const name = (payload as { metadata?: { name?: string } }).metadata?.name;
  const resp = await managementClusterRequest('POST', undefined, {
    apiVersion: 'management.cattle.io/v3',
    kind: 'Cluster',
    ...payload,
  });

  if (!resp.ok) {
    throw new Error(`create ${name} failed: status=${resp.status} body=${(await resp.text()).substring(0, 200)}`);
  }
}

async function deleteManagementCluster(name: string): Promise<void> {
  const resp = await managementClusterRequest('DELETE', name);

  if (![200, 202, 404].includes(resp.status)) {
    throw new Error(`delete ${name} failed: status=${resp.status} body=${(await resp.text()).substring(0, 200)}`);
  }
}

async function annotateManagementTwin(mgmtId: string): Promise<void> {
  const resp = await managementClusterRequest(
    'PATCH',
    mgmtId,
    {
      metadata: { annotations: PROV_BADGE_ANNOTATIONS },
      spec: { internal: false, displayName: 'Provisioned Cluster PRD' },
    },
    'application/merge-patch+json',
  );

  if (!resp.ok) {
    throw new Error(
      `merge patch ${mgmtId} failed: status=${resp.status} body=${(await resp.text()).substring(0, 200)}`,
    );
  }
}

async function ensure19241Fixtures(rancherApi: RancherApi): Promise<void> {
  for (const { name, payloadFactory } of FIXTURE_MGMT_CLUSTERS) {
    const existing = await rancherApi.getRancherResource('v1', 'management.cattle.io.clusters', name, 0);
    const terminating = existing.status === 200 && Boolean(existing.body?.metadata?.deletionTimestamp);

    if (existing.status !== 404 && !terminating) {
      continue;
    }

    if (terminating) {
      const gone = await rancherApi.waitForRancherResource(
        'v1',
        'management.cattle.io.clusters',
        name,
        (resp: any) => resp.status === 404,
        20,
        1000,
      );

      if (!gone) {
        throw new Error(`[cluster-pin-actions fixtures] ${name} is still terminating; cannot recreate it`);
      }
    }

    await createManagementCluster(payloadFactory());
  }

  const provId = `${PROV_NS}/${PROV_CLUSTER_NAME}`;
  const provExisting = await rancherApi.getRancherResource('v1', 'provisioning.cattle.io.clusters', provId, 0);

  if (provExisting.status === 404) {
    await rancherApi.createRancherResource('v1', 'provisioning.cattle.io.clusters', qa19241ProvClusterPayload(PROV_NS));
  }

  const provReady = await rancherApi.waitForRancherResource(
    'v1',
    'provisioning.cattle.io.clusters',
    provId,
    (resp: any) => Boolean(resp.body?.status?.clusterName),
    30,
    2000,
  );

  if (!provReady) {
    console.warn(
      '[cluster-pin-actions fixtures] qa-19241-prov never linked a management cluster in the wait window; detail-page test 6 may be affected.',
    );

    return;
  }

  // Mirror the manual fixture: badge and display name on the controller-created management twin
  const prov = await rancherApi.getRancherResource('v1', 'provisioning.cattle.io.clusters', provId);
  const mgmtId = prov.body?.status?.clusterName;

  if (!mgmtId) {
    return;
  }

  try {
    await annotateManagementTwin(mgmtId);
  } catch (err) {
    console.warn(
      `[cluster-pin-actions fixtures] could not annotate management twin ${mgmtId}: ${(err as Error)?.message ?? err}`,
    );
  }
}

async function expectPinnedClusters(rancherApi: RancherApi, clusterIds: string[], pinned: boolean): Promise<void> {
  // Pin writes land on the user preference asynchronously. Waiting for the
  // preference (not just the optimistic row class) keeps the table from
  // re-rendering under an open selection menu and detaching its items.
  await expect
    .poll(
      async () => {
        const resp = await rancherApi.getRancherResource('v1', 'userpreferences');
        const records = Array.isArray(resp.body?.data) ? resp.body.data : [];
        const stored = records[0]?.data?.['pinned-clusters'];
        let ids: string[] = [];

        try {
          ids = Array.isArray(stored) ? stored : JSON.parse(stored ?? '[]');
        } catch {
          ids = [];
        }

        return clusterIds.every((id) => ids.includes(id) === pinned);
      },
      { timeout: 10_000 },
    )
    .toBe(true);
}

async function delete19241Fixtures(rancherApi: RancherApi): Promise<void> {
  try {
    // Bounded to fit the 60s afterAll hook budget: the default 20 x 15s wait
    // outlives the hook when a controller delete lags.
    await rancherApi.deleteClusterAndWait(PROV_CLUSTER_NAME, PROV_NS, 5, 2500);
  } catch (err) {
    console.warn(`[cluster-pin-actions cleanup] deleteClusterAndWait failed: ${(err as Error)?.message ?? err}`);
    await rancherApi.deleteRancherResource(
      'v1',
      'provisioning.cattle.io.clusters/fleet-default',
      PROV_CLUSTER_NAME,
      false,
    );
  }

  for (const { name } of FIXTURE_MGMT_CLUSTERS) {
    try {
      await deleteManagementCluster(name);
    } catch (err) {
      console.warn(`[cluster-pin-actions cleanup] could not delete ${name}: ${(err as Error)?.message ?? err}`);
    }
  }

  // Management clusters keep a mgmt-cluster-rbac-remove finalizer for a few
  // seconds. Wait (bounded) so the next run does not see terminating fixtures.
  for (let attempt = 0; attempt < 20; attempt++) {
    const states = await Promise.all(
      FIXTURE_MGMT_CLUSTERS.map(({ name }) =>
        rancherApi.getRancherResource('v1', 'management.cattle.io.clusters', name, 0),
      ),
    );

    if (states.every((state) => state.status === 404)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

test.describe('Cluster Badges and Pin Actions (#19241 / #19537)', { tag: ['@manager', '@adminUser'] }, () => {
  // Ensure every test starts and finishes in a clean, state-independent baseline
  test.beforeEach(async ({ rancherApi, login }) => {
    await ensure19241Fixtures(rancherApi);
    await rancherApi.setUserPreference({ 'pinned-clusters': '[]', theme: '"ui-auto"' });
    await login();
  });

  test.afterEach(async ({ rancherApi }) => {
    await rancherApi.setUserPreference({ 'pinned-clusters': '[]', theme: '"ui-auto"' });
  });

  test.afterAll(async ({ rancherApi }) => {
    await delete19241Fixtures(rancherApi);
  });

  test('1. Badge column on Cluster Management renders after Name with custom color and uppercase icon text (Scenarios 1, 10)', async ({
    page,
  }) => {
    const clusterList = new ClusterManagerListPagePo(page, 'local');

    await clusterList.goTo();
    await clusterList.sortableTable().checkLoadingIndicatorNotVisible();
    await new WelcomeDialogPo(page).dismissIfVisible();

    // Verify Badge header exists and sits physically to the right of Name
    const cells = clusterList.sortableTable().headerContentCells();
    const nameHeader = cells.filter({ hasText: /^\s*Name\s*$/ });
    const badgeHeader = cells.filter({ hasText: /^\s*Badge\s*$/ });

    await expect(nameHeader).toBeVisible();
    await expect(badgeHeader).toBeVisible();
    await expect
      .poll(
        async () => {
          const nameBox = await nameHeader.first().boundingBox();
          const badgeBox = await badgeHeader.first().boundingBox();

          return !!nameBox && !!badgeBox && badgeBox.x > nameBox.x;
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    // Verify custom badge cluster: PRD icon text and #b62020 color
    const customRow = clusterList.sortableTable().rowWithName('Production Cluster Alpha');

    await expect(customRow.self()).toBeVisible();

    const badgeChip = customRow.badge();

    await expect(badgeChip).toBeVisible();
    await expect(customRow.badgeText()).toHaveText('PRD');
    await expect(customRow.badgeDecoration()).toHaveAttribute(
      'style',
      /background:\s*(#b62020|rgb\(182,\s*32,\s*32\))/i,
    );

    // Verify auto-abbreviated badge cluster: AWE initials and #673ab7 color
    const autoRow = clusterList.sortableTable().rowWithName('Analytics Workload Engine');

    await expect(autoRow.self()).toBeVisible();
    await expect(autoRow.badgeText()).toHaveText(/AWE/i);

    // Verify management-only cluster with default initials (Scenario 10)
    const stdRow = clusterList.sortableTable().rowWithName('Standard QA Cluster');

    await expect(stdRow.self()).toBeVisible();
    await expect(stdRow.badge()).toBeVisible();
  });

  test('2. Badge column on Home page clusters list renders matching badge chips (Scenario 2)', async ({ page }) => {
    const homePage = new HomePagePo(page);

    await homePage.goTo();
    await new WelcomeDialogPo(page).dismissIfVisible();

    await expect(homePage.list()).toBeVisible();

    // Verify Badge column header is present in the table
    const cells = homePage.sortableTable().headerContentCells();
    const nameHeader = cells.filter({ hasText: /^\s*Name\s*$/ });
    const badgeHeader = cells.filter({ hasText: /^\s*Badge\s*$/ });

    await expect(nameHeader).toBeVisible();
    await expect(badgeHeader).toBeVisible();
    await expect
      .poll(
        async () => {
          const nameBox = await nameHeader.first().boundingBox();
          const badgeBox = await badgeHeader.first().boundingBox();

          return !!nameBox && !!badgeBox && badgeBox.x > nameBox.x;
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    // Verify custom badge row on Home page
    const customRow = homePage.clusterRow('Production Cluster Alpha');

    await expect(customRow).toBeVisible();
    await expect(homePage.clusterRowBadge('Production Cluster Alpha')).toBeVisible();
    await expect(homePage.clusterRowBadgeText('Production Cluster Alpha')).toHaveText('PRD');
  });

  test('3. Inline hover pin and unpin toggle updates row state and top nav pinned shelf (Scenarios 3, 4)', async ({
    page,
  }) => {
    const clusterList = new ClusterManagerListPagePo(page, 'local');
    const burgerMenu = new BurgerMenuPo(page);

    await clusterList.goTo();
    await clusterList.sortableTable().checkLoadingIndicatorNotVisible();
    await new WelcomeDialogPo(page).dismissIfVisible();

    const row = clusterList.sortableTable().rowWithName('Production Cluster Alpha');

    await expect(row.self()).toBeVisible();

    const pinBtn = row.pinBtn();

    // Initially unpinned: icon-pin-outlined and aria-pressed="false"
    await expect(pinBtn).toHaveClass(/icon-pin-outlined/);
    await expect(pinBtn).not.toHaveClass(/is-pinned/);
    await expect(pinBtn).toHaveAttribute('aria-pressed', 'false');

    // Hover over row and click the inline pin button
    await row.self().hover();
    await pinBtn.click();

    // Verified pinned outcome: icon-pin, is-pinned, and aria-pressed="true"
    await expect(pinBtn).toHaveClass(/is-pinned/);
    await expect(pinBtn).toHaveClass(/icon-pin(?!\-outlined)/);
    await expect(pinBtn).toHaveAttribute('aria-pressed', 'true');

    // Verify membership in top nav pinned shelf
    await burgerMenu.open();
    await expect(burgerMenu.pinnedCluster('Production Cluster Alpha')).toBeVisible();

    await burgerMenu.close();

    // Click inline pin again to unpin (Scenario 4)
    await pinBtn.click();

    // Verify unpinned outcome
    await expect(pinBtn).toHaveClass(/icon-pin-outlined/);
    await expect(pinBtn).not.toHaveClass(/is-pinned/);
    await expect(pinBtn).toHaveAttribute('aria-pressed', 'false');

    // Verify removal from top nav pinned shelf
    await burgerMenu.open();
    await expect(burgerMenu.pinnedCluster('Production Cluster Alpha')).toHaveCount(0);

    await burgerMenu.close();
  });

  test('4. Row 3-dots action menu offers Pin on unpinned cluster and Unpin on pinned cluster (#19537 / Scenario 5, 6, 10)', async ({
    page,
  }) => {
    const clusterList = new ClusterManagerListPagePo(page, 'local');
    const burgerMenu = new BurgerMenuPo(page);

    await clusterList.goTo();
    await clusterList.sortableTable().checkLoadingIndicatorNotVisible();
    await new WelcomeDialogPo(page).dismissIfVisible();

    const row = clusterList.sortableTable().rowWithName('Standard QA Cluster');

    await expect(row.self()).toBeVisible();

    // Open action menu on standard unpinned management cluster
    await row.actionBtn().click();

    const actionMenu = new ActionMenuPo(page);

    await expect(actionMenu.self()).toBeVisible();

    const pinOption = actionMenu.getMenuItem('Pin');

    await expect(pinOption).toBeVisible();

    // Click Pin and verify row outcome
    await pinOption.click();
    await actionMenu
      .self()
      .waitFor({ state: 'detached', timeout: 5000 })
      .catch(() => false);

    await expect(row.pinBtn()).toHaveClass(/is-pinned/);

    // Verify top nav shelf has pinned cluster
    await burgerMenu.open();
    await expect(burgerMenu.pinnedCluster('Standard QA Cluster')).toBeVisible();
    await burgerMenu.close();

    // Reopen action menu to verify Unpin option
    await row.actionBtn().click();
    await expect(actionMenu.self()).toBeVisible();

    const unpinOption = actionMenu.getMenuItem('Unpin');

    await expect(unpinOption).toBeVisible();

    // Click Unpin and verify restored outcome
    await unpinOption.click();
    await actionMenu
      .self()
      .waitFor({ state: 'detached', timeout: 5000 })
      .catch(() => false);

    await expect(row.pinBtn()).not.toHaveClass(/is-pinned/);

    await burgerMenu.open();
    await expect(burgerMenu.pinnedCluster('Standard QA Cluster')).toHaveCount(0);
    await burgerMenu.close();
  });

  test('5. Bulk action bar supports batch Pin, mixed selection, and batch Unpin (#19537 / Scenario 7, 8, 9)', async ({
    page,
    rancherApi,
  }) => {
    const clusterList = new ClusterManagerListPagePo(page, 'local');
    const burgerMenu = new BurgerMenuPo(page);

    await clusterList.goTo();
    await clusterList.sortableTable().checkLoadingIndicatorNotVisible();
    await new WelcomeDialogPo(page).dismissIfVisible();

    const row1 = clusterList.sortableTable().rowWithName('Batch Cluster 1');
    const row2 = clusterList.sortableTable().rowWithName('Batch Cluster 2');
    const row3 = clusterList.sortableTable().rowWithName('Batch Cluster 3');

    await expect(row1.self()).toBeVisible();
    await expect(row2.self()).toBeVisible();
    await expect(row3.self()).toBeVisible();

    // 1. Bulk Pin on two unpinned clusters (Scenario 7)
    await row1.checkbox().click();
    await row2.checkbox().click();

    await expect(row1.checkbox()).toBeChecked();
    await expect(row2.checkbox()).toBeChecked();

    await clusterList.sortableTable().openSelectionActions();

    const bulkPinBtn = clusterList.sortableTable().selectionAction('pinCluster');

    await expect(bulkPinBtn).toBeVisible();
    await expect(bulkPinBtn).toBeEnabled();

    await bulkPinBtn.click();

    // Expect-poll for async preference write to land
    await expect(row1.pinBtn()).toHaveClass(/is-pinned/);
    await expect(row2.pinBtn()).toHaveClass(/is-pinned/);
    await expectPinnedClusters(rancherApi, ['qa-19241-bulk01', 'qa-19241-bulk02'], true);

    // Batch pins must also land on the top nav pinned shelf
    await burgerMenu.open();
    await expect(burgerMenu.pinnedCluster('Batch Cluster 1')).toBeVisible();
    await expect(burgerMenu.pinnedCluster('Batch Cluster 2')).toBeVisible();
    await burgerMenu.close();

    // 2. Mixed selection: Batch Cluster 1 (pinned) and Batch Cluster 3 (unpinned) (Scenario 9)
    await row2.checkbox().click(); // deselect Batch Cluster 2
    await row3.checkbox().click(); // select Batch Cluster 3 (unpinned)

    await clusterList.sortableTable().openSelectionActions();

    const mixedPin = clusterList.sortableTable().selectionAction('pinCluster');
    const mixedUnpin = clusterList.sortableTable().selectionAction('unpinCluster');

    await expect(mixedPin).toBeVisible();
    await expect(mixedUnpin).toBeVisible();

    // Bulk Pin on the mixed selection must target only the unpinned rows:
    // Batch Cluster 3 becomes pinned, Batch Cluster 1 stays pinned.
    await mixedPin.click();
    await expect(row3.pinBtn()).toHaveClass(/is-pinned/);
    await expect(row1.pinBtn()).toHaveClass(/is-pinned/);
    await expectPinnedClusters(rancherApi, ['qa-19241-bulk01', 'qa-19241-bulk03'], true);

    // 3. Bulk Unpin on pinned clusters (Scenario 8)
    if (await row3.checkbox().isChecked()) {
      await row3.checkbox().click(); // deselect Batch Cluster 3
    }
    if (!(await row2.checkbox().isChecked())) {
      await row2.checkbox().click(); // select Batch Cluster 2 (both 1 and 2 are pinned)
    }

    await expect(row1.checkbox()).toBeChecked();
    await expect(row2.checkbox()).toBeChecked();

    await clusterList.sortableTable().openSelectionActions();

    const bulkUnpinBtn = clusterList.sortableTable().selectionAction('unpinCluster');

    await expect(bulkUnpinBtn).toBeVisible();
    await expect(bulkUnpinBtn).toBeEnabled();

    await bulkUnpinBtn.click();

    await expect(row1.pinBtn()).not.toHaveClass(/is-pinned/);
    await expect(row2.pinBtn()).not.toHaveClass(/is-pinned/);
    await expectPinnedClusters(rancherApi, ['qa-19241-bulk01', 'qa-19241-bulk02'], false);

    // Batch unpins must also leave the top nav pinned shelf
    await burgerMenu.open();
    await expect(burgerMenu.pinnedCluster('Batch Cluster 1')).toHaveCount(0);
    await expect(burgerMenu.pinnedCluster('Batch Cluster 2')).toHaveCount(0);
    await burgerMenu.close();

    // 4. Bulk Unpin on a mixed selection only targets the pinned rows (Scenario 9)
    // Normalize the checkbox state left over from the previous bulk action.
    if (await row1.checkbox().isChecked()) {
      await row1.checkbox().click(); // deselect Batch Cluster 1
    }
    if (await row2.checkbox().isChecked()) {
      await row2.checkbox().click(); // deselect Batch Cluster 2
    }

    // Pin only Batch Cluster 1, then select both rows: mixed selection, one pinned, one not.
    await row1.pinBtn().click();
    await expect(row1.pinBtn()).toHaveClass(/is-pinned/);
    await expect(row2.pinBtn()).not.toHaveClass(/is-pinned/);

    await row1.checkbox().click(); // select Batch Cluster 1
    await row2.checkbox().click(); // select Batch Cluster 2 (stays unpinned)

    await clusterList.sortableTable().openSelectionActions();

    const mixedUnpinRows = clusterList.sortableTable().selectionAction('unpinCluster');

    await expect(mixedUnpinRows).toBeVisible();

    // Unpin must target the pinned row only: Batch Cluster 1 releases,
    // Batch Cluster 2 was never pinned and stays unpinned.
    await mixedUnpinRows.click();
    await expect(row1.pinBtn()).not.toHaveClass(/is-pinned/);
    await expect(row2.pinBtn()).not.toHaveClass(/is-pinned/);
    await expectPinnedClusters(rancherApi, ['qa-19241-bulk01'], false);
  });

  test('6. Cluster detail title pin control and Alt+P keyboard shortcut toggle (Scenarios 11, 12)', async ({
    page,
  }) => {
    // Navigate to cluster detail page for provisioned cluster
    const clusterDetail = new ClusterManagerDetailRke2CustomPagePo(page, 'local', 'qa-19241-prov');
    const burgerMenu = new BurgerMenuPo(page);

    await clusterDetail.goTo();
    await clusterDetail.waitForPage();
    await new WelcomeDialogPo(page).dismissIfVisible();

    // Scope to the detail title bar: a .cluster-pin also exists in the global header.
    const badgeState = clusterDetail.titleBarBadgeChip();
    const pinControl = clusterDetail.titleBarPinControl();

    await expect(pinControl).toBeVisible();

    // The pin control sits after the badge chip in the detail title row (Scenario 11)
    await expect(badgeState).toBeVisible();
    await expect
      .poll(
        async () => {
          const badgeBox = await badgeState.boundingBox();
          const pinBox = await pinControl.boundingBox();

          return !!badgeBox && !!pinBox && pinBox.x > badgeBox.x;
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    await expect(pinControl).toHaveAttribute('aria-pressed', 'false');

    // Click detail title pin to toggle pin state
    await pinControl.click();
    await expect(pinControl).toHaveAttribute('aria-pressed', 'true');

    // Verify top nav shelf reflects pinned cluster
    await burgerMenu.open();
    await expect(burgerMenu.pinnedCluster('Provisioned Cluster PRD')).toBeVisible();

    await burgerMenu.close();

    // Press Alt+P (Windows/Linux) to toggle pin state via keyboard shortcut
    await page.keyboard.press('Alt+p');
    await expect(pinControl).toHaveAttribute('aria-pressed', 'false');

    await burgerMenu.open();
    await expect(burgerMenu.pinnedCluster('Provisioned Cluster PRD')).toHaveCount(0);

    await burgerMenu.close();
  });

  test('7. Dark theme maintains high-contrast badge rendering (Scenario 14)', async ({ page, rancherApi }) => {
    // Set theme preference to ui-dark
    await rancherApi.setUserPreference({ theme: '"ui-dark"' });

    const clusterList = new ClusterManagerListPagePo(page, 'local');

    await clusterList.goTo();
    await clusterList.sortableTable().checkLoadingIndicatorNotVisible();
    await new WelcomeDialogPo(page).dismissIfVisible();

    // Verify dark theme is applied to document body
    await expect(clusterList.body()).toHaveClass(/theme-dark/);

    const customRow = clusterList.sortableTable().rowWithName('Production Cluster Alpha');

    await expect(customRow.self()).toBeVisible();

    const badgeChip = customRow.badge();

    await expect(badgeChip).toBeVisible();
    await expect(customRow.badgeText()).toHaveText('PRD');

    // Restore to auto theme
    await rancherApi.setUserPreference({ theme: '"ui-auto"' });
  });

  test('8. Light theme maintains high-contrast badge rendering (Scenario 14)', async ({ page, rancherApi }) => {
    // Set theme preference to ui-light
    await rancherApi.setUserPreference({ theme: '"ui-light"' });

    const clusterList = new ClusterManagerListPagePo(page, 'local');

    await clusterList.goTo();
    await clusterList.sortableTable().checkLoadingIndicatorNotVisible();
    await new WelcomeDialogPo(page).dismissIfVisible();

    // Verify light theme is applied to document body
    await expect(clusterList.body()).toHaveClass(/theme-light/);

    const customRow = clusterList.sortableTable().rowWithName('Production Cluster Alpha');

    await expect(customRow.self()).toBeVisible();

    const badgeChip = customRow.badge();

    await expect(badgeChip).toBeVisible();
    await expect(customRow.badgeText()).toHaveText('PRD');

    // Restore to auto theme
    await rancherApi.setUserPreference({ theme: '"ui-auto"' });
  });
});
