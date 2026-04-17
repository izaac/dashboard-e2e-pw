import { test, expect } from '@/support/fixtures';
import OpaGatekeeperPo from '@/e2e/po/other-products/opa-gatekeeper.po';
import { ChartPage } from '@/e2e/po/pages/explorer/charts/chart.po';
import { InstallChartPage } from '@/e2e/po/pages/explorer/charts/install-charts.po';
import { setupOpaGatekeeperRoutes } from '@/e2e/blueprints/other-products/opa-gatekeeper-routes';

test.describe('Charts', { tag: ['@charts', '@adminUser'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test.describe('OPA Gatekeeper resources', () => {
    test('should check conditions related to issue #4600 (template w/ create btn + edit constraints w/ save btn)', async ({ page }) => {
      // Set up route mocks BEFORE navigation so schemas are intercepted
      await setupOpaGatekeeperRoutes(page);

      const opaGatekeeper = new OpaGatekeeperPo(page, 'local');

      await opaGatekeeper.goTo();
      await opaGatekeeper.waitForPage();

      await opaGatekeeper.navToSideMenuEntryByLabel('Template');
      await opaGatekeeper.waitForPage();

      await expect(opaGatekeeper.createFromYaml()).toBeAttached();

      await opaGatekeeper.navToSideMenuEntryByLabel('Constraints');
      await opaGatekeeper.waitForPage();

      await opaGatekeeper.create().click();
      await opaGatekeeper.waitForPage();

      await opaGatekeeper.selectConstraintSubtype('k8sallowedrepos').click();
      await opaGatekeeper.saveCreateForm().expectToBeEnabled();

      await opaGatekeeper.navToSideMenuEntryByLabel('Constraints');
      await opaGatekeeper.create().click();
      await opaGatekeeper.waitForPage();

      await opaGatekeeper.selectConstraintSubtype('k8srequiredlabels').click();
      await opaGatekeeper.saveCreateForm().expectToBeEnabled();
    });
  });

  test.describe('OPA Gatekeeper install', () => {
    test.describe('YAML view', () => {
      test('Footer controls should sticky to bottom', async ({ page }) => {
        const chartPage = new ChartPage(page);
        const installChartPage = new InstallChartPage(page);

        await chartPage.navTo('OPA Gatekeeper');
        await chartPage.waitForPage('repo-type=cluster&repo=rancher-charts&chart=rancher-gatekeeper');
        await chartPage.goToInstall();
        await installChartPage.nextPage();
        await installChartPage.editYaml();

        const footer = installChartPage.wizardFooter();

        await expect(footer).toBeVisible();

        const footerBox = await footer.boundingBox();
        const viewportSize = page.viewportSize();

        expect(footerBox).toBeTruthy();
        expect(viewportSize).toBeTruthy();
        // Footer bottom should be at or near viewport bottom (within 40px tolerance for banners/margins)
        const footerBottom = Math.round(footerBox!.y + footerBox!.height);

        expect(footerBottom).toBeGreaterThan(viewportSize!.height - 40);
        expect(footerBottom).toBeLessThanOrEqual(viewportSize!.height);
      });
    });
  });
});
