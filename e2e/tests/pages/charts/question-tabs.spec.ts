import { test, expect } from '@/support/fixtures';
import { ChartPage } from '@/e2e/po/pages/explorer/charts/chart.po';
import { InstallChartPage } from '@/e2e/po/pages/explorer/charts/install-charts.po';

test.describe('Charts Install', { tag: ['@charts', '@adminUser'] }, () => {
  test.describe('Question tabs', () => {
    test('Should not show any tabs on "Edit Options" screen if there is only 1 group', async ({ page, login }) => {
      await login();

      const chartPage = new ChartPage(page, 'local');
      const installChart = new InstallChartPage(page, 'local');

      await chartPage.goTo('repo-type=cluster&repo=rancher-rke2-charts&chart=rancher-vsphere-cpi&version=1.13.000');
      await chartPage.waitForPage();
      await chartPage.goToInstall();
      await installChart.nextPage();

      const tabs = installChart.tabsCountOnInstallQuestions();

      await expect(tabs).not.toBeAttached();
    });

    test('Should show tabs on "Edit Options" screen because there is more than 1 group', async ({ _page, _login }) => {
      test.skip(true, 'NeuVector chart in 2.13 does not have multiple question groups');
    });
  });
});
