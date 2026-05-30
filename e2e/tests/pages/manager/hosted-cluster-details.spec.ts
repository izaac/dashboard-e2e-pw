import type { Page } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import ClusterManagerDetailHostedPagePo from '@/e2e/po/detail/provisioning.cattle.io.cluster/cluster-detail-hosted.po';
import {
  provisioningClusters,
  managementClusters,
  nodes,
  namespaces,
} from '@/e2e/blueprints/manager/hosted-cluster-mocks';

// ids from hosted-cluster-mocks
const AKS_CLUSTER = 'c-9zj2b';
const GKE_CLUSTER = 'c-5hrg8';
const EKS_CLUSTER = 'c-4sjtl';
const IMPORTED_CLUSTER = 'c-kkwv2';

interface PoolGroup {
  name: string;
  count: number;
  subheader: string;
}

/**
 * Navigate to a hosted cluster's detail page and verify its Node Pools tab:
 * row count, the group-by-pool / flat-list tooltips, grouped row counts and
 * subheaders, and that the internal/external IP column renders an IP.
 * Consolidates upstream's three near-identical AKS/EKS/GKE `it` blocks.
 */
async function verifyHostedNodePoolTab(
  page: Page,
  clusterId: string,
  clusterName: string,
  expected: { rowCount: number; groups: PoolGroup[] },
): Promise<void> {
  const clusterList = new ClusterManagerListPagePo(page);
  const detailsPage = new ClusterManagerDetailHostedPagePo(page, '_', clusterId);

  // TODO(upstream-parity): upstream uses ClusterManagerListPagePo.navTo() (burger
  // menu). We use goTo() for setup nav per the project nav convention; the menu
  // path is covered separately by e2e/tests/navigation/side-nav/. See TODO.md PARAMOUNT.
  await clusterList.goTo();
  await clusterList.waitForPage();

  await clusterList.list().name(clusterName).click();
  await detailsPage.waitForPage();

  const tabs = detailsPage.resourceDetail().tabs();
  const sortableTable = detailsPage.nodePoolTable().sortableTable();

  // Tab labels carry a live count suffix (e.g. "Node Pools (2)"), so match on
  // substring rather than the exact label.
  await expect.poll(async () => (await tabs.tabNames()).some((name) => name.includes('Node Pools'))).toBe(true);

  // Node Pools is the first/default tab, so its table is visible on load.
  await expect(detailsPage.nodePoolTable().self()).toBeVisible();
  await expect.poll(() => sortableTable.rowCount()).toBe(expected.rowCount);

  const groupByPoolTip = detailsPage.groupByPoolToolTip();

  await groupByPoolTip.show();
  await expect(groupByPoolTip.content().filter({ hasText: 'Group by Pool' })).toBeVisible();

  const flatListTip = detailsPage.flatListToolTip();

  await flatListTip.show();
  await expect(flatListTip.content().filter({ hasText: 'Flat List' })).toBeVisible();

  await sortableTable.groupByButtons(1).click();

  // node pool table should not have a 'group by namespace' button
  await expect(sortableTable.groupByButtons(2)).toHaveCount(0);

  for (const group of expected.groups) {
    await expect.poll(() => sortableTable.groupRowCount(group.name)).toBe(group.count);
    await expect(sortableTable.groupElementWithName(group.name)).toContainText(group.subheader);
  }

  // internal/external IP column renders at least an internal IP, not -/-
  await expect(sortableTable.getTableCell(0, 3)).toContainText(/\d+/);
}

test.describe('Hosted Cluster Details', { tag: ['@manager', '@adminUser'] }, () => {
  test.beforeEach(async ({ page, login }) => {
    // Collection endpoints: fetch the real response and override only `data`.
    await page.route(/\/v1\/provisioning\.cattle\.io\.clusters/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();

      await route.fulfill({ response, json: { ...body, data: provisioningClusters } });
    });

    await page.route(/\/v1\/management\.cattle\.io\.clusters/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();

      await route.fulfill({ response, json: { ...body, data: managementClusters } });
    });

    await page.route(/\/v1\/namespaces/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();

      await route.fulfill({ response, json: { ...body, data: namespaces } });
    });

    // Nodes are requested per-cluster: /v1/management.cattle.io.nodes/<clusterId>.
    await page.route(/\/v1\/management\.cattle\.io\.nodes\//, async (route) => {
      const clusterId = new URL(route.request().url()).pathname.split('/').pop();
      const filteredNodes = nodes.filter((n) => n.id.startsWith(`${clusterId}/`));

      await route.fulfill({ status: 200, json: { data: filteredNodes, count: filteredNodes.length, revision: '1' } });
    });

    // Per-id cluster lookups. Registered AFTER the collection routes so they take
    // precedence for the specific-id URLs (Playwright matches handlers in reverse).
    for (const id of [AKS_CLUSTER, GKE_CLUSTER, EKS_CLUSTER, IMPORTED_CLUSTER]) {
      await page.route(new RegExp(`/v1/provisioning\\.cattle\\.io\\.clusters/fleet-default/${id}`), async (route) => {
        await route.fulfill({ status: 200, json: provisioningClusters.find((c) => c.id === `fleet-default/${id}`) });
      });

      await page.route(new RegExp(`/v1/management\\.cattle\\.io\\.clusters/${id}`), async (route) => {
        await route.fulfill({ status: 200, json: managementClusters.find((c) => c.id === id) });
      });
    }

    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();
  });

  test.afterEach(async ({ page }) => {
    // Drain in-flight route handlers so route.fetch() doesn't throw against a
    // closing page during teardown.
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  // eslint-disable-next-line playwright/expect-expect -- assertion via verifyHostedNodePoolTab()
  test('should show a node pool tab in AKS cluster details', async ({ page }) => {
    await verifyHostedNodePoolTab(page, AKS_CLUSTER, 'aks-mock-cluster', {
      rowCount: 2,
      groups: [
        { name: 'agentpool', count: 1, subheader: 'System – eastus – Standard_D2d_v4' },
        { name: 'pool1', count: 1, subheader: 'User – eastus – Standard_D2d_v4' },
      ],
    });
  });

  // eslint-disable-next-line playwright/expect-expect -- assertion via verifyHostedNodePoolTab()
  test('should show a node pool tab in EKS cluster details', async ({ page }) => {
    await verifyHostedNodePoolTab(page, EKS_CLUSTER, 'eks-mock-cluster', {
      rowCount: 3,
      groups: [
        { name: 'group1', count: 2, subheader: 'us-west-2 – t3.medium' },
        { name: 'group2', count: 1, subheader: 'us-west-2 – t3.medium' },
      ],
    });
  });

  // eslint-disable-next-line playwright/expect-expect -- assertion via verifyHostedNodePoolTab()
  test('should show a node pool tab in GKE cluster details', async ({ page }) => {
    await verifyHostedNodePoolTab(page, GKE_CLUSTER, 'gke-mock-cluster', {
      rowCount: 2,
      groups: [
        { name: 'group-1', count: 1, subheader: 'us-central1 – n1-standard-2' },
        { name: 'group-2', count: 1, subheader: 'us-central1 – n1-standard-2' },
      ],
    });
  });

  test('should not show an autoscaler tab in GKE, AKS, or EKS cluster details', async ({ page }) => {
    const clusterList = new ClusterManagerListPagePo(page);
    const hostedClusters = [
      { id: AKS_CLUSTER, name: 'aks-mock-cluster' },
      { id: EKS_CLUSTER, name: 'eks-mock-cluster' },
      { id: GKE_CLUSTER, name: 'gke-mock-cluster' },
    ];

    for (const { id, name } of hostedClusters) {
      const detailsPage = new ClusterManagerDetailHostedPagePo(page, '_', id);

      // TODO(upstream-parity): upstream uses ClusterManagerListPagePo.navTo() (burger menu).
      await clusterList.goTo();
      await clusterList.waitForPage();

      await clusterList.list().name(name).click();
      await detailsPage.waitForPage();

      const tabs = detailsPage.resourceDetail().tabs();

      // Gate on tabs being rendered so the absence check isn't vacuously true.
      await expect.poll(async () => (await tabs.tabNames()).length).toBeGreaterThan(0);
      // Substring match: a present tab could carry a count suffix (e.g. "Autoscaler (n)").
      expect((await tabs.tabNames()).some((name) => name.includes('Autoscaler'))).toBe(false);
    }
  });

  test('should not contain a provisioning log tab in import cluster details', async ({ page }) => {
    const clusterList = new ClusterManagerListPagePo(page);
    const detailsPage = new ClusterManagerDetailHostedPagePo(page, '_', IMPORTED_CLUSTER);

    // TODO(upstream-parity): upstream uses ClusterManagerListPagePo.navTo() (burger menu).
    await clusterList.goTo();
    await clusterList.waitForPage();

    await clusterList.list().name('imported-mock-cluster').click();
    await detailsPage.waitForPage();

    const tabs = detailsPage.resourceDetail().tabs();

    await expect.poll(async () => (await tabs.tabNames()).length).toBeGreaterThan(0);
    // Substring match: a present tab could carry a count suffix (e.g. "Provisioning Log (n)").
    expect((await tabs.tabNames()).some((name) => name.includes('Provisioning Log'))).toBe(false);
  });
});
