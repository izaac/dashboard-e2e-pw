import { test, expect } from '@/support/fixtures';
import ClusterToolsPagePo from '@/e2e/po/pages/explorer/cluster-tools.po';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import { InstallChartPage } from '@/e2e/po/pages/explorer/charts/install-charts.po';
import KubectlPo from '@/e2e/po/components/kubectl.po';
import { LONG, VERY_LONG, PROVISIONING } from '@/support/timeouts';
import type { RancherApi } from '@/support/fixtures/rancher-api';

// Upstream Cypress test uses 'rancher-alerting-drivers'; we use OPA Gatekeeper because
// alerting-drivers (and most 109.x charts) require k8s 1.33+ AND a working
// kuberlr-kubectl binary path that recent rancher images disable. OPA Gatekeeper 104.x
// has looser kubeVersion and no patch-sa hook — installs cleanly across rancher tags.
const chartName = 'OPA Gatekeeper';
const chartKey = 'rancher-gatekeeper';
const chartRepo = 'rancher-charts';
const chartNamespace = 'cattle-gatekeeper-system';

async function ensureChartUninstalled(rancherApi: RancherApi): Promise<void> {
  await rancherApi.uninstallChart(chartNamespace, chartKey);
  await rancherApi.waitForRancherResource(
    'v1',
    'catalog.cattle.io.apps',
    `${chartNamespace}/${chartKey}`,
    (resp) => resp.status === 404,
    30,
    2000,
  );
}

/**
 * Seed the chart in 'deployed' state via API. Faster and more reliable than
 * driving the UI install flow for tests that only assert the edit/uninstall flow.
 */
async function ensureChartInstalled(rancherApi: RancherApi): Promise<void> {
  const appResp = await rancherApi.getRancherResource(
    'v1',
    'catalog.cattle.io.apps',
    `${chartNamespace}/${chartKey}`,
    0,
  );

  if (appResp.status === 200 && appResp.body?.metadata?.state?.name === 'deployed') {
    return;
  }

  if (appResp.status === 200) {
    await ensureChartUninstalled(rancherApi);
  }

  await rancherApi.createRancherResource(
    'v1',
    `catalog.cattle.io.clusterrepos/${chartRepo}?action=install`,
    {
      charts: [{ chartName: chartKey, namespace: chartNamespace, releaseName: chartKey }],
      noHooks: false,
      timeout: '600s',
      wait: false,
      namespace: chartNamespace,
      projectId: '',
    },
    false,
  );

  const deployed = await rancherApi.waitForRancherResource(
    'v1',
    'catalog.cattle.io.apps',
    `${chartNamespace}/${chartKey}`,
    (resp) => resp.body?.metadata?.state?.name === 'deployed',
    40,
    3000,
  );

  if (!deployed) {
    throw new Error(`Chart '${chartKey}' did not reach deployed state within polling window`);
  }
}

test.describe('Cluster Tools', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('can navigate to cluster tools and see all feature charts', async ({ page }) => {
    const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

    await clusterDashboard.goTo();
    await clusterDashboard.waitForPage();
    await clusterDashboard.navToSideMenuEntryByLabel('Tools');

    const clusterTools = new ClusterToolsPagePo(page, 'local');

    await clusterTools.waitForPage();

    const cards = clusterTools.featureChartCards();

    await expect(cards.first()).toBeVisible();
    const count = await cards.count();

    expect(count).toBeGreaterThanOrEqual(1);
  });

  test.describe(`${chartName} chart lifecycle`, () => {
    test.describe.configure({ mode: 'serial' });

    test.afterAll(async ({ rancherApi }) => {
      await ensureChartUninstalled(rancherApi);
    });

    test.describe('install', () => {
      test.beforeEach(async ({ rancherApi, chartGuard }) => {
        await chartGuard(chartRepo, chartKey);
        await ensureChartUninstalled(rancherApi);
      });

      test('can deploy chart successfully', async ({ page, rancherApi }) => {
        test.setTimeout(PROVISIONING);

        const clusterTools = new ClusterToolsPagePo(page, 'local');
        const installChartPage = new InstallChartPage(page);
        const terminal = new KubectlPo(page);

        await clusterTools.goTo();
        await clusterTools.waitForPage();

        const chartVersionLocator = clusterTools.getChartVersion(chartName);

        await expect(chartVersionLocator).not.toHaveText('');

        await clusterTools.goToInstall(chartName);
        await installChartPage.nextPage();

        const responsePromise = page.waitForResponse(
          (resp) =>
            resp.url().includes(`v1/catalog.cattle.io.clusterrepos/${chartRepo}?action=install`) &&
            resp.request().method() === 'POST',
        );

        await installChartPage.installChart();

        const response = await responsePromise;

        expect(response.status()).toBe(201);

        await terminal.waitForTerminalStatus('Disconnected', VERY_LONG);
        await terminal.closeTerminal();
        await clusterTools.waitForPage();

        const deployed = await rancherApi.waitForRancherResource(
          'v1',
          'catalog.cattle.io.apps',
          `${chartNamespace}/${chartKey}`,
          (resp) => resp.body?.metadata?.state?.name === 'deployed',
          40,
          3000,
        );

        expect(deployed, `Chart '${chartKey}' did not reach deployed state`).toBeTruthy();
      });
    });

    test.describe('manage installed chart', () => {
      test.beforeEach(async ({ rancherApi, chartGuard }) => {
        test.setTimeout(PROVISIONING);
        await chartGuard(chartRepo, chartKey);
        await ensureChartInstalled(rancherApi);
      });

      test('can edit chart successfully', async ({ page }) => {
        test.setTimeout(PROVISIONING);

        const clusterTools = new ClusterToolsPagePo(page, 'local');
        const installChartPage = new InstallChartPage(page);
        const terminal = new KubectlPo(page);

        await clusterTools.goTo();
        await clusterTools.waitForPage();
        await clusterTools.editChart(chartName);

        await installChartPage.nextPage();

        const responsePromise = page.waitForResponse(
          (resp) =>
            resp.url().includes(`v1/catalog.cattle.io.clusterrepos/${chartRepo}?action=upgrade`) &&
            resp.request().method() === 'POST',
        );

        await installChartPage.installChart();

        const response = await responsePromise;

        expect(response.status()).toBe(201);

        await terminal.waitForTerminalStatus('Disconnected', VERY_LONG);
        await terminal.closeTerminal();
        await clusterTools.waitForPage();
      });

      test('can uninstall chart successfully', async ({ page }) => {
        test.setTimeout(PROVISIONING);

        const clusterTools = new ClusterToolsPagePo(page, 'local');
        const terminal = new KubectlPo(page);

        await clusterTools.goTo();
        await clusterTools.waitForPage();
        await clusterTools.deleteChart(chartName);

        const responsePromise = page.waitForResponse(
          (resp) =>
            resp.url().includes(`catalog.cattle.io.apps/${chartNamespace}/${chartKey}?action=uninstall`) &&
            resp.request().method() === 'POST',
        );

        const promptRemove = new PromptRemove(page);

        await promptRemove.remove();

        const response = await responsePromise;

        expect(response.status()).toBe(201);

        await terminal.waitForTerminalStatus('Disconnected', LONG);
        await terminal.closeTerminal();
      });
    });
  });
});
