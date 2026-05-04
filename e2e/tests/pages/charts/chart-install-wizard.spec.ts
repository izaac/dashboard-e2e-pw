import { test, expect } from '@/support/fixtures';
import { ChartPage } from '@/e2e/po/pages/explorer/charts/chart.po';
import { InstallChartPage } from '@/e2e/po/pages/explorer/charts/install-charts.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import ChartInstalledAppsListPagePo from '@/e2e/po/pages/chart-installed-apps.po';
import { NamespaceFilterPo } from '@/e2e/po/components/namespace-filter.po';

const configMapPayload = {
  apiVersion: 'v1',
  kind: 'ConfigMap',
  metadata: {
    name: `e2e-test-${+new Date()}`,
    annotations: {},
    labels: {},
    namespace: 'default',
  },
  data: { foo: 'bar' },
  __clone: true,
};

test.describe('Charts Wizard', { tag: ['@charts', '@adminUser', '@noVai'] }, () => {
  test.describe.configure({ mode: 'serial' });
  const testChartsRepoName = 'test-charts';
  const testChartsGitRepoUrl = 'https://github.com/richard-cox/rodeo';
  const testChartsBranchName = 'master';

  test.beforeEach(async ({ login }) => {
    await login();
  });

  test.describe('Check resources are selectable in the chart install wizard', () => {
    test.afterEach(async ({ rancherApi }) => {
      // Clean up chart repo and configmap regardless of test outcome
      await rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', testChartsRepoName, false);
      await rancherApi.deleteRancherResource(
        'v1',
        'configmaps',
        `${configMapPayload.metadata.namespace}/${configMapPayload.metadata.name}`,
        false,
      );
    });

    test('Resource dropdown picker has ConfigMaps listed', async ({ page, rancherApi }) => {
      test.setTimeout(120000);
      // Clean up first in case resources exist from a previous failed run
      await rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', testChartsRepoName, false);
      await rancherApi.deleteRancherResource(
        'v1',
        'configmaps',
        `${configMapPayload.metadata.namespace}/${configMapPayload.metadata.name}`,
        false,
      );

      // Reset namespace filter so chart install defaults to 'default' namespace
      await rancherApi.setUserPreference({ local: JSON.stringify({ local: ['all://user'] }) });

      // Setup: create chart repo and configmap
      await rancherApi.createRancherResource('v1', 'catalog.cattle.io.clusterrepos', {
        type: 'catalog.cattle.io.clusterrepo',
        metadata: { name: testChartsRepoName },
        spec: {
          clientSecret: null,
          gitRepo: testChartsGitRepoUrl,
          gitBranch: testChartsBranchName,
        },
      });

      await rancherApi.createRancherResource('v1', 'configmaps', configMapPayload);

      // Wait for the repo to be downloaded before navigating
      await rancherApi.waitForRepositoryDownload('v1', 'catalog.cattle.io.clusterrepos', testChartsRepoName);

      const installChartPage = new InstallChartPage(page);
      const chartPage = new ChartPage(page);
      const tabbedPo = new TabbedPo(page, '[data-testid="tabbed-block"]');

      await chartPage.navTo('rancher-demo');
      await chartPage.waitForChartHeader('rancher-demo', 30000);
      await chartPage.goToInstall();
      await installChartPage.chartName().fill('rancher-demo');

      // Ensure the chart installs into the 'default' namespace so the configmap dropdown shows our test configmap
      const nsSelect = installChartPage.nameNsDescription().namespace();

      if (
        await nsSelect
          .self()
          .isVisible()
          .catch(() => false)
      ) {
        await installChartPage.selectNamespaceOption('default');
      }

      await installChartPage.nextPage();

      await expect(tabbedPo.allTabs()).toHaveCount(4);
      await installChartPage.selectTab(tabbedPo, 'Other Demo Fields');

      const labeledSelect = new LabeledSelectPo(page, 'section[id="Other Demo Fields"] [type="search"]');

      await labeledSelect.self().scrollIntoViewIfNeeded();
      await labeledSelect.toggle();
      await labeledSelect.clickLabel(configMapPayload.metadata.name);
    });
  });

  test.describe('Custom registry', () => {
    const chartName = 'Rancher Backups';
    const customRegistry = 'my.custom.registry:5000';
    const chartNamespace = 'cattle-resources-system';
    const chartApp = 'rancher-backup';
    const chartCrd = 'rancher-backup-crd';

    test.afterEach(async ({ rancherApi }) => {
      await rancherApi.uninstallChart(chartNamespace, chartApp, chartCrd);
    });

    test('should persist custom registry when changing chart version', async ({ page, rancherApi, chartGuard }) => {
      test.setTimeout(180000);
      await chartGuard('rancher-charts', 'rancher-backup');
      const namespacePicker = new NamespaceFilterPo(page);
      const installChartPage = new InstallChartPage(page);
      const chartPage = new ChartPage(page);
      const installedAppsPage = new ChartInstalledAppsListPagePo(page, 'local', 'apps');

      // Ensure charts are uninstalled before starting
      await rancherApi.uninstallChart(chartNamespace, chartApp, chartCrd);

      // Set namespace filter
      await rancherApi.setUserPreference({ local: JSON.stringify({ local: ['all://user'] }) });

      // Install the chart first so the versions selector shows up later
      await chartPage.navTo(chartName);
      await chartPage.waitForChartHeader(chartName, 30000);
      await chartPage.goToInstall();
      await installChartPage.nextPage();

      // Set up namespace selection
      await namespacePicker.toggle();
      await namespacePicker.optionByLabel('All Namespaces').click();
      await namespacePicker.closeChevron().click();

      // Listen for install response before triggering
      const installResponsePromise = page.waitForResponse(
        (resp) =>
          /\/v1\/catalog\.cattle\.io\.(clusterrepos|apps)\/.*\?action=(install|upgrade)/.test(resp.url()) && resp.ok(),
      );

      await installChartPage.installChart();

      await installedAppsPage.waitForInstallCloseTerminal(installResponsePromise, [
        'rancher-backup',
        'rancher-backup-crd',
      ]);

      // Navigate back to chart
      await chartPage.navTo(chartName);
      await chartPage.waitForChartHeader(chartName, 30000);
      await chartPage.goToInstall();

      // The version selector should now be visible
      await expect(installChartPage.chartVersionSelector().self()).toBeVisible();

      await installChartPage.customRegistryCheckbox().set();

      // Enter custom registry
      await expect(installChartPage.customRegistryInput().self()).toBeVisible();
      await installChartPage.customRegistryInput().set(customRegistry);

      // Change chart version
      await installChartPage.chartVersionSelector().toggle();
      await installChartPage.chartVersionSelector().clickOption(2);

      // Verify custom registry is still there
      await installChartPage.customRegistryCheckbox().isChecked();
      await expect(installChartPage.customRegistryInput().self()).toHaveValue(customRegistry);
    });
  });
});
