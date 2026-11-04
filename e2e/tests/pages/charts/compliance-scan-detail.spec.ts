import { test, expect } from '@/support/fixtures';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import path from 'path';
import fs from 'fs';
import ChartRepositoriesPagePo from '@/e2e/po/pages/chart-repositories.po';
import ChartRepositoriesCreateEditPo from '@/e2e/po/edit/chart-repositories.po';
import { ChartPage } from '@/e2e/po/pages/explorer/charts/chart.po';
import { InstallChartPage } from '@/e2e/po/pages/explorer/charts/install-charts.po';
import ClusterScanPagePo from '@/e2e/po/pages/compliance/clusterscan.po';
import PagePo from '@/e2e/po/pages/page.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import ResourceDetailMetadataPo from '@/e2e/po/detail/resource-detail-metadata.po';
import { FULL_PROVISIONING, LONG, PROVISIONING } from '@/support/timeouts';

const REPO_NAME = 'e2e-suse-app-collection';
const LEFTOVER_REPO_NAME = 'qa-16735-suse-app-collection';
const APP_COLLECTION_OCI_URL = 'oci://dp.apps.rancher.io/charts';

const CHART_NAMESPACE = 'compliance-operator-system';
const CHART_NAME = 'rancher-compliance';
const CHART_CRD_NAME = 'rancher-compliance-crd';
const SCAN_TYPE = 'compliance.cattle.io.clusterscans';
const SCAN_LABELS = { 'qa-issue': '16735' };
const SCAN_ANNOTATIONS = { 'qa-note': 'ui-created one-time scan, defaults' };
const SCAN_POLL_RETRIES = 120;
const SCAN_POLL_INTERVAL = 5_000;

const EVIDENCE_DIR = path.join(__dirname, 'evidence-16735');

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function deleteResource(
  api: RancherApi,
  prefix: string,
  type: string,
  id: string,
  description: string,
): Promise<void> {
  try {
    await api.deleteRancherResource(prefix, type, id, false);
  } catch (err) {
    console.warn(`[#16735 cleanup] could not delete ${description}: ${(err as Error)?.message ?? err}`);
  }
}

/** Remove the chart pair, every scan from a previous run, and the stray service. */
async function preCleanCompliance(api: RancherApi): Promise<void> {
  await api.ensureChartUninstalled(CHART_NAMESPACE, CHART_NAME, CHART_CRD_NAME, 90, 2_000);

  const labeled = await api.getRancherResource('v1', `${SCAN_TYPE}?labelSelector=qa-issue%3D16735`, undefined, 0);

  for (const scan of labeled.body.data ?? []) {
    await deleteResource(api, 'v1', SCAN_TYPE, scan.id, `scan ${scan.id}`);
  }
  await deleteResource(api, 'v1', 'services', `${CHART_NAMESPACE}/service-rancher-compliance`, 'stray service');
}

/**
 * Steve puts a status update in flight around scan completion, so retry the
 * fetch-modify-put once if the controller bumps resourceVersion between GET and PUT.
 */
async function labelScan(api: RancherApi, name: string): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { body } = await api.getRancherResource('v1', SCAN_TYPE, name);

    body.metadata.labels = { ...(body.metadata.labels ?? {}), ...SCAN_LABELS };
    body.metadata.annotations = { ...(body.metadata.annotations ?? {}), ...SCAN_ANNOTATIONS };
    delete body.links;
    delete body.actions;

    const resp = await api.updateRancherResource('v1', SCAN_TYPE, name, body, false);

    if (resp.status === 200) {
      return;
    }
    if (resp.status !== 409 || attempt === 3) {
      throw new Error(`Failed to label scan ${name}: HTTP ${resp.status}`);
    }
  }
}

test.describe('Compliance scan detail header layout (#16735)', { tag: ['@adminUser', '@charts'] }, () => {
  test.use({ viewport: { width: 1680, height: 1000 } });

  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('SUSE Application Collection repository can be added from zero and becomes active', async ({
    page,
    rancherApi,
  }) => {
    test.skip(!process.env.APPCO_USER || !process.env.APPCO_KEY, 'Requires SUSE Application Collection credentials');
    test.setTimeout(PROVISIONING);

    await deleteResource(rancherApi, 'v1', 'catalog.cattle.io.clusterrepos', LEFTOVER_REPO_NAME, 'leftover repo');
    await deleteResource(rancherApi, 'v1', 'catalog.cattle.io.clusterrepos', REPO_NAME, 'previous repo');

    const reposPage = new ChartRepositoriesPagePo(page, 'local', 'apps');
    const createPage = new ChartRepositoriesCreateEditPo(page, 'local', 'apps');

    try {
      await reposPage.goTo();
      await reposPage.waitForPage();
      await reposPage.addRepositoryLink().click();
      await createPage.waitForPage();
      await createPage.selectSuseAppCollectionCard();

      await expect(createPage.ociUrlInput()).toBeDisabled();
      await expect(createPage.ociUrlInput()).toHaveValue(APP_COLLECTION_OCI_URL);

      await createPage.suseAppCollectionNameInput().fill(REPO_NAME);
      await createPage.basicUsernameInput().fill(process.env.APPCO_USER!);
      await createPage.basicPasswordInput().fill(process.env.APPCO_KEY!);
      await createPage.saveCreateForm().click();

      await reposPage.waitForPage();
      await expect(reposPage.list().state(REPO_NAME)).toContainText('Active', { timeout: LONG });

      await reposPage
        .list()
        .rowWithName(REPO_NAME)
        .self()
        .screenshot({ path: path.join(EVIDENCE_DIR, 'repo-active.png') });
    } finally {
      await deleteResource(rancherApi, 'v1', 'catalog.cattle.io.clusterrepos', REPO_NAME, 'created repo');
      await deleteResource(rancherApi, 'v1', 'catalog.cattle.io.clusterrepos', LEFTOVER_REPO_NAME, 'leftover repo');
    }
  });

  test('compliance chart installed from zero ends with a left-aligned scan detail header', async ({
    page,
    rancherApi,
    chartGuard,
  }) => {
    test.setTimeout(FULL_PROVISIONING);
    await chartGuard('rancher-charts', CHART_NAME);

    const chartPage = new ChartPage(page);
    const installPage = new InstallChartPage(page);
    const scanPage = new ClusterScanPagePo(page);
    let scanName: string | undefined;

    await preCleanCompliance(rancherApi);

    try {
      await chartPage.navTo('Rancher Compliance');
      await chartPage.waitForChartHeader('Rancher Compliance', LONG);
      await chartPage.goToInstall();
      await installPage.nextPage();
      await installPage.installChart();

      await rancherApi.expectResourceState(
        'v1',
        'catalog.cattle.io.apps',
        `${CHART_NAMESPACE}/${CHART_NAME}`,
        (resp) => resp.status === 200 && resp.body?.metadata?.state?.name === 'deployed',
        SCAN_POLL_RETRIES,
        SCAN_POLL_INTERVAL,
      );

      await scanPage.goTo();
      await scanPage.goToCreate();
      await expect(page).toHaveURL(/compliance\.cattle\.io\.clusterscan\/create/);
      await expect(scanPage.passRadio()).toBeChecked();
      await expect(scanPage.runOnceRadio()).toBeChecked();

      const createResponse = page.waitForResponse(
        (resp) => resp.url().includes(`/v1/${SCAN_TYPE}`) && resp.request().method() === 'POST',
      );

      await scanPage.submitCreate();

      const scanResp = await createResponse;

      expect(scanResp.status()).toBe(201);

      const createdScanName: string = (await scanResp.json()).metadata.name;

      scanName = createdScanName;
      expect(createdScanName).toMatch(/^scan-/);

      await rancherApi.expectResourceState(
        'v1',
        SCAN_TYPE,
        createdScanName,
        (resp) => {
          const state = resp.body?.metadata?.state;

          return (
            resp.status === 200 && state?.transitioning === false && (state?.name === 'pass' || state?.name === 'fail')
          );
        },
        SCAN_POLL_RETRIES,
        SCAN_POLL_INTERVAL,
      );

      await labelScan(rancherApi, createdScanName);

      await scanPage.goTo();
      await expect(scanPage.rowState(createdScanName)).toContainText(/Pass|Fail/i, { timeout: LONG });
      await scanPage
        .row(createdScanName)
        .self()
        .screenshot({ path: path.join(EVIDENCE_DIR, 'scan-completed-row.png') });

      const detailPage = new PagePo(page, `/c/local/compliance/compliance.cattle.io.clusterscan/${createdScanName}`);
      const detail = new ResourceDetailPo(page);
      const metadata = new ResourceDetailMetadataPo(page);

      await detailPage.goTo();
      await detailPage.waitForPage();

      await expect(detail.title()).toContainText(createdScanName);
      await expect(detail.stateBadge()).toContainText(/Pass|Fail/i);
      await expect(metadata.self()).toBeVisible();
      await expect(metadata.identifyingInfo()).not.toBeAttached();
      await expect(metadata.firstColumn()).toHaveClass(/labels/);

      const rowBox = await metadata.self().boundingBox();
      const firstColumnBox = await metadata.firstColumn().boundingBox();

      expect(rowBox).not.toBeNull();
      expect(firstColumnBox).not.toBeNull();
      expect(firstColumnBox!.x - rowBox!.x).toBeLessThanOrEqual(1);

      await page.screenshot({
        path: path.join(EVIDENCE_DIR, 'scan-detail-header.png'),
        clip: { x: 0, y: 0, width: 1680, height: 420 },
      });
      await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scan-detail-full.png'), fullPage: true });
    } finally {
      if (scanName) {
        await deleteResource(rancherApi, 'v1', SCAN_TYPE, scanName, `scan ${scanName}`);
      }
      await rancherApi.ensureChartUninstalled(CHART_NAMESPACE, CHART_NAME, CHART_CRD_NAME, 90, 2_000);
    }
  });
});
