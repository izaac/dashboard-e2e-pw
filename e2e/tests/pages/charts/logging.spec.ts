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
import { BRIEF, SHORT_TIMEOUT_OPT, LONG, STANDARD, VERY_LONG, PROVISIONING } from '@/support/timeouts';

const chartAppDisplayName = 'Logging';
const chartApp = 'rancher-logging';
const chartCrd = 'rancher-logging-crd';
const chartNamespace = 'cattle-logging-system';
const chartRepo = 'rancher-charts';

test.describe('Logging Chart', { tag: ['@charts', '@adminUser'] }, () => {
  // Serial: install + manage tests share a single rancher-logging install/uninstall cycle in cattle-logging-system.
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ login, rancherApi, chartGuard }) => {
    await rancherApi.waitForHealthy();
    await chartGuard(chartRepo, chartApp);
    await login();
  });

  test.afterAll(async ({ rancherApi }) => {
    try {
      await rancherApi.ensureChartUninstalled(chartNamespace, chartApp, chartCrd, 60, BRIEF);
    } finally {
      await rancherApi.updateNamespaceFilter('local', 'none', '{"local":["all://user"]}');
      await rancherApi.waitForHealthy();
    }
  });

  test.describe('install', () => {
    test.beforeEach(async ({ rancherApi }) => {
      test.setTimeout(PROVISIONING);
      await rancherApi.ensureChartUninstalled(chartNamespace, chartApp, chartCrd, 60, BRIEF);
    });

    test('can deploy chart via UI', async ({ page, rancherApi }) => {
      test.setTimeout(PROVISIONING);

      await rancherApi.updateNamespaceFilter('local', 'none', '{"local":[]}');

      const installChartPage = new InstallChartPage(page);
      const chartPage = new ChartPage(page);
      const terminal = new KubectlPo(page);

      await chartPage.navTo('Logging');
      await chartPage.waitForChartHeader('Logging', 20_000);
      await chartPage.waitForPage();
      await chartPage.goToInstall();
      await installChartPage.nextPage();

      const chartInstallPromise = page.waitForResponse(
        (resp) =>
          resp.url().includes(`v1/catalog.cattle.io.clusterrepos/${chartRepo}?action=install`) &&
          resp.request().method() === 'POST',
      );

      await installChartPage.installChart();

      const installResp = await chartInstallPromise;

      expect(installResp.status()).toBe(201);

      await terminal.waitForTerminalStatus('Disconnected', VERY_LONG);
      await terminal.closeTerminal();

      const deployed = await rancherApi.waitForRancherResource(
        'v1',
        'catalog.cattle.io.apps',
        `${chartNamespace}/${chartApp}`,
        (resp) => resp.body?.metadata?.state?.name === 'deployed',
        60,
        BRIEF,
      );

      expect(deployed, `Chart '${chartApp}' did not reach deployed state`).toBeTruthy();
    });
  });

  test.describe('manage installed chart', () => {
    let flowName: string;
    let outputName: string;

    test.beforeAll(async ({ rancherApi }) => {
      flowName = rancherApi.createE2EResourceName('logging-flow');
      outputName = rancherApi.createE2EResourceName('logging-output');
    });

    test.beforeEach(async ({ rancherApi }) => {
      test.setTimeout(PROVISIONING);
      await rancherApi.ensureChartInstalled(chartRepo, chartNamespace, chartApp, chartCrd);
      await rancherApi.updateNamespaceFilter('local', 'none', '{"local":[]}');
    });

    // testing https://github.com/rancher/dashboard/issues/13845
    test('can create cluster output and flow', async ({ page, rancherApi }) => {
      test.setTimeout(PROVISIONING);

      const loggingPo = new LoggingPo(page);
      const basePage = new PagePo(page, '/c/local/logging');

      // Big charts like logging can take 2+ minutes for CRDs to register
      let reachedPage = false;

      for (let attempt = 0; attempt < 20; attempt++) {
        await page.goto('./c/local/logging/logging.banzaicloud.io.clusteroutput', { waitUntil: 'domcontentloaded' });

        const isFailWhale = await basePage.isFailWhaleVisible();

        if (!isFailWhale) {
          reachedPage = true;
          break;
        }

        // Unavoidable: polling for CRD registration — no event to wait on

        await page.waitForTimeout(STANDARD);
      }

      expect(reachedPage, 'Logging CRDs not registered after 200s — fail-whale persisted').toBeTruthy();

      try {
        await loggingPo.mastheadCreate().click();

        await loggingPo.nameInput().fill(outputName);
        await loggingPo.outputTargetInput().fill('random.domain.site');

        const outputSavePromise = page.waitForResponse(
          (resp) =>
            resp.url().includes('/v1/logging.banzaicloud.io.clusteroutputs') && resp.request().method() === 'POST',
        );

        await loggingPo.formSave().click();

        const outputResp = await outputSavePromise;
        const outputBody = await outputResp.json();

        expect(outputResp.status()).toBe(201);
        expect(outputBody.metadata.name).toBe(outputName);

        await expect(loggingPo.tableRowByText(outputName)).toBeAttached();

        const sideNav = new ProductNavPo(page);

        await sideNav.navToSideMenuEntryByLabel('ClusterFlows');

        await loggingPo.mastheadCreate().click();
        await loggingPo.nameInput().fill(flowName);
        await loggingPo.outputsTab().click();
        await loggingPo.flowOutputSelector().click();
        await loggingPo.dropdownOptions().filter({ hasText: outputName }).first().click();

        await loggingPo.matchTab().click();

        const namespaces = ['fleet-default', 'cattle-system'];

        const nsSelectContainer = loggingPo.matchNamespaceSelector();

        await expect(nsSelectContainer).toBeAttached(SHORT_TIMEOUT_OPT);
        await nsSelectContainer.scrollIntoViewIfNeeded();
        await nsSelectContainer.click();

        for (const ns of namespaces) {
          await page.keyboard.type(ns);
          await expect(loggingPo.dropdownOptions().first()).toBeVisible({ timeout: STANDARD });
          await loggingPo.dropdownOptions().filter({ hasText: ns }).first().click();
        }

        const flowSavePromise = page.waitForResponse(
          (resp) =>
            resp.url().includes('/v1/logging.banzaicloud.io.clusterflows') && resp.request().method() === 'POST',
        );

        await loggingPo.formSave().click();

        const flowResp = await flowSavePromise;
        const flowBody = await flowResp.json();

        expect(flowResp.status()).toBe(201);
        expect(flowBody.metadata.name).toBe(flowName);
        expect(flowBody.spec.match[0].select.namespaces[0]).toContain(namespaces[0]);
        expect(flowBody.spec.match[0].select.namespaces[1]).toBe(namespaces[1]);

        await expect(loggingPo.tableRowByText(flowName)).toBeAttached();

        await loggingPo.rowDetailLink(flowName).click();

        await expect(loggingPo.flowRuleItem(0)).toBeVisible({ timeout: LONG });
      } finally {
        await rancherApi.deleteRancherResource('v1', 'logging.banzaicloud.io.clusterflows', flowName, false);
        await rancherApi.deleteRancherResource('v1', 'logging.banzaicloud.io.clusteroutputs', outputName, false);
      }
    });

    // testing https://github.com/rancher/dashboard/issues/4849
    test('can uninstall both chart and crd at once', async ({ page }) => {
      test.setTimeout(PROVISIONING);

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

      await expect(installedAppsPage.appsList().self()).toBeVisible();
      await installedAppsPage.appsList().sortableTable().checkLoadingIndicatorNotVisible();

      await expect(installedAppsPage.appsList().sortableTable().rowElementWithName(chartApp)).toBeVisible({
        timeout: LONG,
      });
      await expect(installedAppsPage.appsList().sortableTable().rowElementWithName(chartCrd)).toBeVisible({
        timeout: LONG,
      });

      await clusterTools.goTo();
      await clusterTools.waitForPage();

      await page.waitForResponse((resp) => resp.url().includes(`${CLUSTER_APPS_BASE_URL}?`) && resp.ok());

      await clusterTools.deleteChart(chartAppDisplayName);

      const promptRemove = new PromptRemove(page);

      const chartUninstallPromise = page.waitForResponse(
        (resp) =>
          resp.url().includes(`${CLUSTER_APPS_BASE_URL}/${chartNamespace}/${chartApp}?action=uninstall`) &&
          resp.request().method() === 'POST',
      );
      const crdUninstallPromise = page.waitForResponse(
        (resp) =>
          resp.url().includes(`${CLUSTER_APPS_BASE_URL}/${chartNamespace}/${chartCrd}?action=uninstall`) &&
          resp.request().method() === 'POST',
      );

      await expect(promptRemove.checkbox().self()).toContainText('Delete the CRD associated with this app');
      await promptRemove.checkbox().set();
      await expect(promptRemove.checkbox().checkboxCustom()).toHaveAttribute('aria-checked', 'true');
      await promptRemove.remove();

      const card = new CardPo(page);

      await expect(card.self()).not.toBeAttached();

      const chartUninstallResp = await chartUninstallPromise;
      const crdUninstallResp = await crdUninstallPromise;

      expect(chartUninstallResp.status()).toBe(201);
      expect(crdUninstallResp.status()).toBe(201);

      await terminal.waitForTerminalStatus('Disconnected', LONG);
      await terminal.closeTerminalByTabName(`Uninstall ${chartNamespace}:${chartApp}`);
      await terminal.waitForTerminalStatus('Disconnected', LONG);
      await terminal.closeTerminalByTabName(`Uninstall ${chartNamespace}:${chartCrd}`);

      await installedAppsPage.goTo();
      await installedAppsPage.waitForPage();

      await page.waitForResponse((resp) => resp.url().includes(`${CLUSTER_APPS_BASE_URL}?`) && resp.ok());

      await expect(installedAppsPage.appsList().self()).toBeVisible();
      await installedAppsPage.appsList().sortableTable().checkLoadingIndicatorNotVisible();

      await expect(installedAppsPage.appsList().sortableTable().rowElementWithName(chartApp)).not.toBeVisible({
        timeout: LONG,
      });
      await expect(installedAppsPage.appsList().sortableTable().rowElementWithName(chartCrd)).not.toBeVisible({
        timeout: LONG,
      });
    });
  });
});
