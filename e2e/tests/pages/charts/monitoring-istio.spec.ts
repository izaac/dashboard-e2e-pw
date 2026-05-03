import { test, expect } from '@/support/fixtures';
import KubectlPo from '@/e2e/po/components/kubectl.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import { ChartPage } from '@/e2e/po/pages/explorer/charts/chart.po';
import { ChartsPage } from '@/e2e/po/pages/explorer/charts/charts.po';
import { InstallChartPage } from '@/e2e/po/pages/explorer/charts/install-charts.po';
import { PrometheusTab } from '@/e2e/po/pages/explorer/charts/tabs/prometheus-tab.po';
import { GrafanaTab } from '@/e2e/po/pages/explorer/charts/tabs/grafana-tab.po';

test.describe('Charts', { tag: ['@charts', '@adminUser'] }, () => {
  const CHART = {
    name: 'Monitoring',
    id: 'rancher-monitoring',
    repo: 'rancher-charts',
  };

  test.beforeEach(async ({ page, login, chartGuard }) => {
    await chartGuard('rancher-charts', 'rancher-monitoring');
    await login();
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test.describe('Monitoring', () => {
    test.describe('Prometheus local provisioner config', () => {
      const provisionerVersion = 'v0.0.24';
      const storageClass = 'local-path';

      test.beforeEach(async ({ page }) => {
        const chartsPage = new ChartsPage(page);
        const terminal = new KubectlPo(page);

        await chartsPage.goTo();
        await chartsPage.waitForPage();

        // Open terminal and apply provisioner
        await terminal.openTerminal(60000);

        await terminal.executeCommand(
          `apply -f https://raw.githubusercontent.com/rancher/local-path-provisioner/${provisionerVersion}/deploy/local-path-storage.yaml`,
        );
        await terminal.executeCommand(
          'apply -f https://raw.githubusercontent.com/rancher/local-path-provisioner/master/examples/pvc/pvc.yaml',
        );
        await terminal.executeCommand(
          'apply -f https://raw.githubusercontent.com/rancher/local-path-provisioner/master/examples/pod/pod.yaml',
        );

        await terminal.closeTerminal();
      });

      test.afterEach(async ({ page }) => {
        // Clean up provisioner resources via kubectl
        const terminal = new KubectlPo(page);

        try {
          await terminal.openTerminal(30000);
          await terminal.executeCommand('delete pod volume-test --ignore-not-found=true', 3000);
          await terminal.executeCommand('delete pvc local-path-pvc --ignore-not-found=true', 3000);
          await terminal.closeTerminal();
        } catch {
          // Best-effort cleanup
        }
      });

      test('Prometheus and Grafana should have all relevant storage options and Storage Class inputs', async ({
        page,
      }) => {
        const chartPage = new ChartPage(page);
        const installChart = new InstallChartPage(page);
        const tabbedOptions = new TabbedPo(page);
        const prometheus = new PrometheusTab(page);
        const grafana = new GrafanaTab(page);

        await chartPage.navTo('Monitoring');
        await chartPage.waitForChartPage(CHART.repo, CHART.id);
        await chartPage.goToInstall();
        await installChart.waitForChartPage(CHART.repo, CHART.id);

        // Check Grafana has all storage options: https://github.com/rancher/dashboard/issues/11540
        await installChart.nextPage();
        await installChart.selectTab(tabbedOptions, grafana.tabID());
        await installChart.waitForChartPage(CHART.repo, CHART.id);

        await expect(grafana.storageOptions().getAllOptions()).toHaveCount(4);
        await expect(grafana.storageOptions().radioSpanByLabel('Disabled')).toHaveAttribute('aria-checked', 'true');

        const options = [
          'Disabled',
          'Enable With Existing PVC',
          'Enable with PVC Template',
          'Enable with StatefulSet Template',
        ];

        for (let index = 0; index < options.length; index++) {
          await expect(grafana.storageOptions().getOptionByIndex(index)).toHaveText(options[index]);
        }

        // Check Grafana has storage class input: https://github.com/rancher/dashboard/issues/11539
        await grafana.storageOptions().set(2);
        await expect(grafana.storageClass().self()).toBeAttached();
        await grafana.storageClass().dropdown().click();
        await grafana.storageClass().clickOptionWithLabel(storageClass);
        await expect(grafana.storageClass().selectedOption()).toHaveText(storageClass, { useInnerText: true });

        await grafana.storageOptions().set(3);
        await expect(grafana.storageClass().self()).toBeAttached();
        await grafana.storageClass().dropdown().click();
        await grafana.storageClass().clickOptionWithLabel(storageClass);
        await expect(grafana.storageClass().selectedOption()).toHaveText(storageClass, { useInnerText: true });

        // Check Prometheus has storage class input: https://github.com/rancher/dashboard/issues/11539
        await installChart.selectTab(tabbedOptions, prometheus.tabID());
        await installChart.waitForChartPage(CHART.repo, CHART.id);

        await prometheus.scrollToTabBottom();

        await expect(prometheus.persistentStorage().self()).toBeVisible();
        await prometheus.persistentStorage().set();

        await expect(prometheus.storageClass().self()).toBeAttached();
        await prometheus.storageClass().dropdown().click();
        await prometheus.storageClass().clickOptionWithLabel(storageClass);
        await expect(prometheus.storageClass().selectedOption()).toHaveText(storageClass, { useInnerText: true });
      });
    });
  });
});
