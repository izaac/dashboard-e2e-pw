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
import PagePo from '@/e2e/po/pages/page.po';

test.describe('Logging Chart', { tag: ['@charts', '@adminUser'] }, () => {
  test.describe.configure({ mode: 'serial' });
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

  test.beforeEach(async ({ login, chartGuard }) => {
    await chartGuard('rancher-charts', 'rancher-logging');
    await login();
  });

  test('is installed and a rule created', async ({ page, rancherApi }) => {
    test.setTimeout(300000);
    // Reset namespace filter
    await rancherApi.setUserPreference({ local: JSON.stringify({ local: [] }) });

    // Ensure logging is installed and deployed
    const appResp = await rancherApi.getRancherResource(
      'v1',
      'catalog.cattle.io.apps',
      `${chartNamespace}/${chartApp}`,
      0,
    );
    const isDeployed = appResp.status === 200 && appResp.body?.metadata?.state?.name === 'deployed';

    if (!isDeployed) {
      // If app exists in non-deployed state (e.g., uninstalling), wait for it to be gone
      if (appResp.status === 200) {
        await rancherApi.createRancherResource(
          'v1',
          `catalog.cattle.io.apps/${chartNamespace}/${chartApp}?action=uninstall`,
          {},
          false,
        );
        await rancherApi.createRancherResource(
          'v1',
          `catalog.cattle.io.apps/${chartNamespace}/${chartCrd}?action=uninstall`,
          {},
          false,
        );
        // Poll until apps are fully removed (404)
        await rancherApi.waitForRancherResource(
          'v1',
          'catalog.cattle.io.apps',
          `${chartNamespace}/${chartApp}`,
          (resp) => resp.status === 404,
          60,
          5000,
        );
      }

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
        (resp) =>
          resp.url().includes('v1/catalog.cattle.io.clusterrepos/rancher-charts?action=install') &&
          resp.request().method() === 'POST',
      );

      await installChartPage.installChart();

      const installResp = await chartInstallPromise;

      expect(installResp.status()).toBe(201);

      await terminal.waitForTerminalStatus('Disconnected');
      await terminal.closeTerminal();

      // Wait for the logging app to be fully deployed
      await rancherApi.waitForRancherResource(
        'v1',
        'catalog.cattle.io.apps',
        `${chartNamespace}/${chartApp}`,
        (resp) => {
          return resp.body?.metadata?.state?.name === 'deployed';
        },
        40,
        5000,
      );
    }

    const loggingPo = new LoggingPo(page);
    const basePage = new PagePo(page, '/c/local/logging');

    // Navigate to ClusterOutput list — retry if fail-whale (CRDs may take time to register)
    for (let attempt = 0; attempt < 5; attempt++) {
      await page.goto('./c/local/logging/logging.banzaicloud.io.clusteroutput', { waitUntil: 'domcontentloaded' });

      // Check if the page loaded correctly (not fail-whale)
      const isFailWhale = await basePage.isFailWhaleVisible();

      if (!isFailWhale) {
        break;
      }

      // Wait before retrying - allows page to fully render/recover
      // eslint-disable-next-line playwright/no-wait-for-timeout
      await page.waitForTimeout(3000);
    }

    // Create cluster output
    await loggingPo.mastheadCreate().click();

    // Fill in output name
    await loggingPo.nameInput().fill(outputName);

    // Set target
    await loggingPo.outputTargetInput().fill('random.domain.site');

    // Save and verify
    const outputSavePromise = page.waitForResponse(
      (resp) => resp.url().includes('/v1/logging.banzaicloud.io.clusteroutputs') && resp.request().method() === 'POST',
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

    // Scroll the match section to reveal the namespace select below nodes/containers
    const nsSelectContainer = loggingPo.matchNamespaceSelector();

    await expect(nsSelectContainer).toBeAttached({ timeout: 15000 });
    await nsSelectContainer.scrollIntoViewIfNeeded();
    await nsSelectContainer.click();

    for (const ns of namespaces) {
      // Type into the currently focused search input
      await page.keyboard.type(ns);
      await expect(loggingPo.dropdownOptions().first()).toBeVisible({ timeout: 10000 });
      await loggingPo.dropdownOptions().filter({ hasText: ns }).first().click();
    }

    // Save flow
    const flowSavePromise = page.waitForResponse(
      (resp) => resp.url().includes('/v1/logging.banzaicloud.io.clusterflows') && resp.request().method() === 'POST',
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
    await loggingPo.rowDetailLink(flowName).click();

    // Verify rule item is visible (the detail page shows match rules in array-list items)
    await expect(loggingPo.flowRuleItem(0)).toBeVisible({ timeout: 30000 });
  });

  // testing https://github.com/rancher/dashboard/issues/4849
  test('can uninstall both chart and crd at once', async ({ page, rancherApi }) => {
    test.setTimeout(180000);
    // This test requires logging to be installed and deployed.
    const appResp = await rancherApi.getRancherResource(
      'v1',
      'catalog.cattle.io.apps',
      `${chartNamespace}/${chartApp}`,
      0,
    );
    const loggingInstalled = appResp.status === 200 && appResp.body?.metadata?.state?.name === 'deployed';

    test.skip(
      !loggingInstalled,
      'Logging chart is not installed — run the "is installed and a rule created" test first',
    );

    // Set namespace filter to show all namespaces
    await rancherApi.setUserPreference({ local: JSON.stringify({ local: [] }) });

    // Set namespace filter to show all namespaces (logging installs to a system namespace)
    await rancherApi.setUserPreference({ local: JSON.stringify({ local: [] }) });

    const clusterTools = new ClusterToolsPagePo(page, 'local');
    const installedAppsPage = new ChartInstalledAppsListPagePo(page, 'local', 'apps');
    const terminal = new KubectlPo(page);

    const CLUSTER_APPS_BASE_URL = 'v1/catalog.cattle.io.apps';

    await installedAppsPage.goTo();
    await installedAppsPage.waitForPage();

    const getChartsResp = await page.waitForResponse(
      (resp) => resp.url().includes(`${CLUSTER_APPS_BASE_URL}?`) && resp.ok(),
    );

    expect(getChartsResp.status()).toBe(200);

    await installedAppsPage.appsList().checkVisible();
    await installedAppsPage.appsList().sortableTable().checkLoadingIndicatorNotVisible();

    // Verify both charts exist
    await expect(installedAppsPage.appsList().sortableTable().rowElementWithName(chartApp)).toBeVisible({
      timeout: 30000,
    });
    await expect(installedAppsPage.appsList().sortableTable().rowElementWithName(chartCrd)).toBeVisible({
      timeout: 30000,
    });

    // Navigate to Cluster Tools and delete
    await clusterTools.goTo();
    await clusterTools.waitForPage();

    await page.waitForResponse((resp) => resp.url().includes(`${CLUSTER_APPS_BASE_URL}?`) && resp.ok());

    await clusterTools.deleteChart(chartAppDisplayName);

    const promptRemove = new PromptRemove(page);

    // Set up uninstall response listeners before triggering
    const chartUninstallPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`${CLUSTER_APPS_BASE_URL}/cattle-logging-system/rancher-logging?action=uninstall`) &&
        resp.request().method() === 'POST',
    );
    const crdUninstallPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`${CLUSTER_APPS_BASE_URL}/cattle-logging-system/rancher-logging-crd?action=uninstall`) &&
        resp.request().method() === 'POST',
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
    await expect(installedAppsPage.appsList().sortableTable().rowElementWithName(chartApp)).not.toBeVisible({
      timeout: 30000,
    });
    await expect(installedAppsPage.appsList().sortableTable().rowElementWithName(chartCrd)).not.toBeVisible({
      timeout: 30000,
    });
  });

  test.afterAll(async ({ rancherApi }) => {
    // Final cleanup: uninstall logging if still present
    await rancherApi.createRancherResource(
      'v1',
      `catalog.cattle.io.apps/${chartNamespace}/${chartApp}?action=uninstall`,
      {},
      false,
    );
    await rancherApi.createRancherResource(
      'v1',
      `catalog.cattle.io.apps/${chartNamespace}/${chartCrd}?action=uninstall`,
      {},
      false,
    );
  });
});
