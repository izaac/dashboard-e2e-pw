import { test, expect } from '@/support/fixtures';
import { ChartPage } from '@/e2e/po/pages/explorer/charts/chart.po';
import { InstallChartPage } from '@/e2e/po/pages/explorer/charts/install-charts.po';
import KubectlPo from '@/e2e/po/components/kubectl.po';
import ClusterToolsPagePo from '@/e2e/po/pages/explorer/cluster-tools.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import ChartInstalledAppsListPagePo from '@/e2e/po/pages/chart-installed-apps.po';
import CardPo from '@/e2e/po/components/card.po';
import LoggingPo from '@/e2e/po/other-products/logging.po';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';

test.describe('Logging Chart', { tag: ['@charts', '@adminUser'] }, () => {
  const chartAppDisplayName = 'Logging';
  const chartApp = 'rancher-logging';
  const chartCrd = 'rancher-logging-crd';
  const chartNamespace = 'cattle-logging-system';

  let flowName: string;
  let outputName: string;

  test.beforeAll(async ({ rancherApi }) => {
    flowName = rancherApi.createE2EResourceName('logging-flow');
    outputName = rancherApi.createE2EResourceName('logging-output');
  });

  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('is installed and a rule created', { timeout: 180000 }, async ({ page, rancherApi }) => {
    // Ensure logging is not installed before starting
    await rancherApi.createRancherResource('v1', `catalog.cattle.io.apps/${chartNamespace}/${chartApp}?action=uninstall`, {}, false);
    await rancherApi.createRancherResource('v1', `catalog.cattle.io.apps/${chartNamespace}/${chartCrd}?action=uninstall`, {}, false);

    // Reset namespace filter
    await rancherApi.setUserPreference({ 'local': JSON.stringify({ local: [] }) });

    const installChartPage = new InstallChartPage(page);
    const chartPage = new ChartPage(page);
    const terminal = new KubectlPo(page);

    await chartPage.navTo('Logging');
    await chartPage.waitForChartHeader('Logging', 20000);
    await chartPage.waitForPage();
    await chartPage.goToInstall();
    await installChartPage.nextPage();

    // Set up install response listener right before the action
    const chartInstallPromise = page.waitForResponse(
      (resp) => resp.url().includes('v1/catalog.cattle.io.clusterrepos/rancher-charts?action=install') && resp.request().method() === 'POST'
    );

    await installChartPage.installChart();

    const installResp = await chartInstallPromise;

    expect(installResp.status()).toBe(201);

    await terminal.waitForTerminalStatus('Disconnected');
    await terminal.closeTerminal();

    const loggingPo = new LoggingPo(page);

    // Navigate to ClusterOutput list
    await page.goto('./c/local/logging/logging.banzaicloud.io.clusteroutput', { waitUntil: 'domcontentloaded' });

    // Create cluster output
    await loggingPo.mastheadCreate().click();

    // Fill in output name
    await loggingPo.nameInput().fill(outputName);

    // Set target
    await loggingPo.outputTargetInput().fill('random.domain.site');

    // Save and verify
    const outputSavePromise = page.waitForResponse(
      (resp) => resp.url().includes('/v1/logging.banzaicloud.io.clusteroutputs') && resp.request().method() === 'POST'
    );

    await loggingPo.formSave().click();

    const outputResp = await outputSavePromise;
    const outputBody = await outputResp.json();

    expect(outputResp.status()).toBe(201);
    expect(outputBody.metadata.name).toBe(outputName);

    // Verify output appears in list
    await expect(loggingPo.tableRowByText(outputName)).toBeAttached();

    // Navigate to ClusterFlow
    const sideNav = new ProductNavPo(page);

    await sideNav.navToSideMenuEntryByLabel('ClusterFlows');

    // Create flow
    await loggingPo.mastheadCreate().click();

    // Fill in flow name
    await loggingPo.nameInput().fill(flowName);

    // Click outputs tab
    await loggingPo.outputsTab().click();

    // Select output
    await loggingPo.flowOutputSelector().click();
    await loggingPo.dropdownOptions().filter({ hasText: outputName }).first().click();

    // Configure namespaces (testing #13845)
    await loggingPo.matchTab().click();

    const namespaces = ['fleet-default', 'cattle-system'];

    // Set namespace values using the namespace combobox in the match section
    // The match tab has 3 comboboxes: nodes, containers, namespaces
    // Use the searchbox role elements — the 3rd one is namespaces
    const matchSection = page.locator('section#match');
    const nsSearchInput = matchSection.getByRole('searchbox').nth(2);

    await expect(nsSearchInput).toBeVisible({ timeout: 10000 });

    for (const ns of namespaces) {
      await nsSearchInput.click();
      await nsSearchInput.fill(ns);
      await expect(loggingPo.dropdownOptions().first()).toBeVisible({ timeout: 10000 });
      await loggingPo.dropdownOptions().filter({ hasText: ns }).first().click();
    }

    // Save flow
    const flowSavePromise = page.waitForResponse(
      (resp) => resp.url().includes('/v1/logging.banzaicloud.io.clusterflows') && resp.request().method() === 'POST'
    );

    await loggingPo.formSave().click();

    const flowResp = await flowSavePromise;
    const flowBody = await flowResp.json();

    expect(flowResp.status()).toBe(201);
    expect(flowBody.metadata.name).toBe(flowName);
    expect(flowBody.spec.match[0].select.namespaces[0]).toContain(namespaces[0]);
    expect(flowBody.spec.match[0].select.namespaces[1]).toBe(namespaces[1]);

    // Verify flow appears in list
    await expect(loggingPo.tableRowByText(flowName)).toBeAttached();

    // Go to details page
    await loggingPo.tableRowByText(flowName).locator('td.col-link-detail a').click();

    // Verify rule item is visible
    await expect(loggingPo.flowRuleItem(0)).toBeVisible();
  });

  // testing https://github.com/rancher/dashboard/issues/4849
  test('can uninstall both chart and crd at once', { timeout: 180000 }, async ({ page, rancherApi }) => {
    // This test requires logging to be installed.
    // Check if it's installed; if not, install via API.
    const appsResp = await rancherApi.getRancherResource('v1', 'catalog.cattle.io.apps', undefined, 200);
    const apps = appsResp.body.data || [];
    const loggingInstalled = apps.some((a: any) => a.metadata?.name === chartApp && a.metadata?.namespace === chartNamespace);

    if (!loggingInstalled) {
      // Install logging via the chart install API
      const repoResp = await rancherApi.getRancherResource('v1', 'catalog.cattle.io.clusterrepos', 'rancher-charts', 200);
      const repoBody = repoResp.body;

      await rancherApi.createRancherResource('v1', `catalog.cattle.io.clusterrepos/rancher-charts?action=install`, {
        charts: [
          { chartName: 'rancher-logging-crd', version: repoBody.status?.indexedCharts?.['rancher-logging-crd']?.[0]?.version || '', namespace: chartNamespace, releaseName: chartCrd },
          { chartName: 'rancher-logging', version: repoBody.status?.indexedCharts?.['rancher-logging']?.[0]?.version || '', namespace: chartNamespace, releaseName: chartApp },
        ],
        noHooks: false,
        timeout: '600s',
        wait: true,
        namespace: chartNamespace,
        projectId: '',
      }, false);

      // Wait for the apps to appear
      await rancherApi.waitForRancherResource('v1', 'catalog.cattle.io.apps', `${chartNamespace}/${chartApp}`, (resp) => {
        return resp.body?.metadata?.state?.name === 'deployed';
      }, 40, 5000);
    }

    const clusterTools = new ClusterToolsPagePo(page, 'local');
    const installedAppsPage = new ChartInstalledAppsListPagePo(page, 'local', 'apps');
    const terminal = new KubectlPo(page);

    const CLUSTER_APPS_BASE_URL = 'v1/catalog.cattle.io.apps';

    await installedAppsPage.goTo();
    await installedAppsPage.waitForPage();

    const getChartsResp = await page.waitForResponse(
      (resp) => resp.url().includes(`${CLUSTER_APPS_BASE_URL}?`) && resp.ok()
    );

    expect(getChartsResp.status()).toBe(200);

    await installedAppsPage.appsList().checkVisible();
    await installedAppsPage.appsList().sortableTable().checkLoadingIndicatorNotVisible();

    // Verify both charts exist
    await expect(installedAppsPage.appsList().sortableTable().rowElementWithName(chartApp)).toBeVisible({ timeout: 30000 });
    await expect(installedAppsPage.appsList().sortableTable().rowElementWithName(chartCrd)).toBeVisible({ timeout: 30000 });

    // Navigate to Cluster Tools and delete
    await clusterTools.goTo();
    await clusterTools.waitForPage();

    await page.waitForResponse((resp) => resp.url().includes(`${CLUSTER_APPS_BASE_URL}?`) && resp.ok());

    await clusterTools.deleteChart(chartAppDisplayName);

    const promptRemove = new PromptRemove(page);

    // Set up uninstall response listeners before triggering
    const chartUninstallPromise = page.waitForResponse(
      (resp) => resp.url().includes(`${CLUSTER_APPS_BASE_URL}/cattle-logging-system/rancher-logging?action=uninstall`) && resp.request().method() === 'POST'
    );
    const crdUninstallPromise = page.waitForResponse(
      (resp) => resp.url().includes(`${CLUSTER_APPS_BASE_URL}/cattle-logging-system/rancher-logging-crd?action=uninstall`) && resp.request().method() === 'POST'
    );

    await promptRemove.checkbox().shouldContainText('Delete the CRD associated with this app');
    await promptRemove.checkbox().set();
    await promptRemove.checkbox().isChecked();
    await promptRemove.remove();

    const card = new CardPo(page);

    await card.checkNotExists();

    const chartUninstallResp = await chartUninstallPromise;
    const crdUninstallResp = await crdUninstallPromise;

    expect(chartUninstallResp.status()).toBe(201);
    expect(crdUninstallResp.status()).toBe(201);

    await terminal.waitForTerminalStatus('Disconnected', 30000);
    await terminal.closeTerminalByTabName('Uninstall cattle-logging-system:rancher-logging');
    await terminal.waitForTerminalStatus('Disconnected', 30000);
    await terminal.closeTerminalByTabName('Uninstall cattle-logging-system:rancher-logging-crd');

    // Verify charts are removed
    await installedAppsPage.goTo();
    await installedAppsPage.waitForPage();

    await page.waitForResponse((resp) => resp.url().includes(`${CLUSTER_APPS_BASE_URL}?`) && resp.ok());

    await installedAppsPage.appsList().checkVisible();
    await installedAppsPage.appsList().sortableTable().checkLoadingIndicatorNotVisible();

    // Verify chart rows are gone
    await expect(installedAppsPage.appsList().sortableTable().rowElementWithName(chartApp)).not.toBeVisible({ timeout: 30000 });
    await expect(installedAppsPage.appsList().sortableTable().rowElementWithName(chartCrd)).not.toBeVisible({ timeout: 30000 });
  });

  test.afterAll(async ({ rancherApi }) => {
    // Final cleanup: uninstall logging if still present
    await rancherApi.createRancherResource('v1', `catalog.cattle.io.apps/${chartNamespace}/${chartApp}?action=uninstall`, {}, false);
    await rancherApi.createRancherResource('v1', `catalog.cattle.io.apps/${chartNamespace}/${chartCrd}?action=uninstall`, {}, false);
  });
});
