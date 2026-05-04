import { test, expect } from '@/support/fixtures';
import ClusterToolsPagePo from '@/e2e/po/pages/explorer/cluster-tools.po';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import { InstallChartPage } from '@/e2e/po/pages/explorer/charts/install-charts.po';
import KubectlPo from '@/e2e/po/components/kubectl.po';
import { DEBOUNCE, LONG, VERY_LONG, PROVISIONING } from '@/support/timeouts';

// Upstream Cypress test uses 'rancher-alerting-drivers'; we use OPA Gatekeeper because
// alerting-drivers (and most 109.x charts) require k8s 1.33+ AND a working
// kuberlr-kubectl binary path that recent rancher images disable. OPA Gatekeeper 104.x
// has looser kubeVersion and no patch-sa hook — installs cleanly across rancher tags.
const chartName = 'OPA Gatekeeper';
const chartKey = 'rancher-gatekeeper';
const chartCrd = 'rancher-gatekeeper-crd';
const chartRepo = 'rancher-charts';
const chartNamespace = 'cattle-gatekeeper-system';

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
    // Serial: install → edit → uninstall act on the same chart in cattle-gatekeeper-system; parallel would race the apps CR.
    test.describe.configure({ mode: 'serial' });

    test.afterAll(async ({ rancherApi }) => {
      await rancherApi.ensureChartUninstalled(chartNamespace, chartKey, chartCrd);
    });

    test.describe('install', () => {
      test.beforeEach(async ({ rancherApi, chartGuard }) => {
        test.setTimeout(PROVISIONING);
        await chartGuard(chartRepo, chartKey);
        await rancherApi.ensureChartUninstalled(chartNamespace, chartKey, chartCrd);
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
          DEBOUNCE,
        );

        expect(deployed, `Chart '${chartKey}' did not reach deployed state`).toBeTruthy();
      });
    });

    test.describe('manage installed chart', () => {
      test.beforeEach(async ({ rancherApi, chartGuard }) => {
        test.setTimeout(PROVISIONING);
        await chartGuard(chartRepo, chartKey);
        await rancherApi.ensureChartInstalled(chartRepo, chartNamespace, chartKey, chartCrd, 40, DEBOUNCE);
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
