import { test, expect } from '@/support/fixtures';
import { ChartsPagePo } from '@/e2e/po/pages/explorer/charts/charts.po';
import { ChartInstallPagePo } from '@/e2e/po/pages/explorer/charts/chart-install.po';

test.describe('Charts Install', { tag: ['@charts', '@adminUser'] }, () => {
  test.describe('Question tabs', () => {
    test('Should not show any tabs on "Edit Options" screen if there is only 1 group', async ({ page, login }) => {
      await login();

      const chartPage = new ChartsPagePo(page, 'local');
      const installChart = new ChartInstallPagePo(page, 'local');

      await chartPage.goTo('repo-type=cluster&repo=rancher-rke2-charts&chart=rancher-vsphere-cpi&version=1.13.000');
      await chartPage.waitForPage();
      await chartPage.goToInstall();
      await installChart.nextPage();

      const tabs = installChart.tabsOnInstallQuestions();

      await expect(tabs).not.toBeAttached();
    });

    test('Should show tabs on "Edit Options" screen because there is more than 1 group', async ({ page, login }) => {
      await login();

      const chartPage = new ChartsPagePo(page, 'local');
      const installChart = new ChartInstallPagePo(page, 'local');

      await chartPage.goTo('repo-type=cluster&repo=rancher-charts&chart=neuvector');
      await chartPage.waitForPage();
      await chartPage.goToInstall();
      await installChart.nextPage();

      const tabs = installChart.tabsOnInstallQuestions();
      const count = await tabs.count();

      expect(count).toBeGreaterThan(3);
    });
  });
});
