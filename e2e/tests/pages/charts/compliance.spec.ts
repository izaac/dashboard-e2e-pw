import { test, expect } from '@/support/fixtures';
import { ChartPage } from '@/e2e/po/pages/explorer/charts/chart.po';
import { InstallChartPage } from '@/e2e/po/pages/explorer/charts/install-charts.po';
import KubectlPo from '@/e2e/po/components/kubectl.po';
import ChartInstalledAppsListPagePo from '@/e2e/po/pages/chart-installed-apps.po';
import { NamespaceFilterPo } from '@/e2e/po/components/namespace-filter.po';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';
import ResourceListMastheadPo from '@/e2e/po/components/resource-list-masthead.po';
import ResourceTablePo from '@/e2e/po/components/resource-table.po';
import CreateEditViewPo from '@/e2e/po/components/create-edit-view.po';
import PagePo from '@/e2e/po/pages/page.po';
import { LONG } from '@/support/timeouts';

const chartNamespace = 'compliance-operator-system';

test.describe('Charts', { tag: ['@charts', '@adminUser'] }, () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ login, chartGuard }) => {
    await chartGuard('rancher-charts', 'rancher-compliance');
    await login();
  });

  test.describe('Compliance install', () => {
    test.afterEach(async ({ rancherApi }) => {
      await rancherApi.uninstallChart(chartNamespace, 'rancher-compliance', 'rancher-compliance-crd');
      await rancherApi.setUserPreference({ local: JSON.stringify({ local: ['all://user'] }) });
    });

    test.describe('YAML view', () => {
      test('Footer controls should sticky to bottom', async ({ page }) => {
        const chartPage = new ChartPage(page);
        const installChartPage = new InstallChartPage(page);

        await chartPage.navTo('Rancher Compliance');
        await chartPage.waitForChartHeader('Rancher Compliance', 30000);
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

    test.describe('Compliance Chart setup', () => {
      test('Complete install and a Scan is created', async ({ page, rancherApi }) => {
        test.setTimeout(180000);
        // Clean up first in case charts exist from a previous failed run
        await rancherApi.uninstallChart(chartNamespace, 'rancher-compliance', 'rancher-compliance-crd');

        // Reset namespace filter
        await rancherApi.setUserPreference({ local: JSON.stringify({ local: [] }) });

        const chartPage = new ChartPage(page);
        const installChartPage = new InstallChartPage(page);
        const terminal = new KubectlPo(page);
        const installedAppsPage = new ChartInstalledAppsListPagePo(page, 'local', 'apps');

        await chartPage.navTo('Rancher Compliance');
        await chartPage.waitForChartHeader('Rancher Compliance', 30000);
        await chartPage.goToInstall();

        await installChartPage.nextPage();

        // Set up intercept right before the action that triggers it
        const installActionPromise = page.waitForResponse(
          (resp) => resp.url().includes('action=install') && resp.request().method() === 'POST',
        );

        await installChartPage.installChart();

        // Wait for terminal to show installation progress and complete
        await terminal.waitForTerminalStatus('Disconnected', 60000);
        await terminal.closeTerminal();

        // Navigate to installed apps page and wait for load
        // Set up response listener before navigation
        const getInstalledAppsPromise = page.waitForResponse(
          (resp) => resp.url().includes('catalog.cattle.io.app') && resp.ok(),
        );

        await installedAppsPage.goTo();

        await getInstalledAppsPromise;

        // Set namespace filter to show all namespaces (compliance installs to a system namespace)
        const namespacePicker = new NamespaceFilterPo(page);

        await namespacePicker.toggle();
        await namespacePicker.clickOptionByLabel('All Namespaces');
        await namespacePicker.closeDropdown();

        // Wait for the apps list to be visible
        await expect(installedAppsPage.appsList().self()).toBeVisible({ timeout: LONG });

        await expect(installedAppsPage.appsList().self()).toBeVisible();
        await installedAppsPage.appsList().sortableTable().checkLoadingIndicatorNotVisible();

        // Verify compliance components are present
        await expect(installedAppsPage.appsList().sortableTable().rowElementWithName('rancher-compliance')).toBeVisible(
          { timeout: LONG },
        );
        await expect(
          installedAppsPage.appsList().sortableTable().rowElementWithName('rancher-compliance-crd'),
        ).toBeVisible({ timeout: LONG });

        const basePage = new PagePo(page, '/c/local/compliance');

        await basePage.waitForDashboardRoot();
        const sideNav = new ProductNavPo(page);

        await sideNav.navToSideMenuGroupByLabel('Compliance');

        // Open terminal and apply test profile
        await terminal.openTerminal(60000);
        await terminal.executeCommand(
          'apply -f https://raw.githubusercontent.com/rancher/compliance-operator/refs/heads/main/tests/k3s-bench-test.yaml',
        );
        await terminal.closeTerminal();

        // Create scan via API and verify response
        const scanResponsePromise = page.waitForResponse(
          (resp) => resp.url().includes('v1/compliance.cattle.io.clusterscans') && resp.request().method() === 'POST',
        );

        // Navigate to compliance list and create scan
        const masthead = new ResourceListMastheadPo(page, '.dashboard-root');

        await masthead.create();

        // Save the scan form
        const createEditView = new CreateEditViewPo(page, '.dashboard-root');

        await createEditView.formSave().click();

        const scanResp = await scanResponsePromise;
        const scanBody = await scanResp.json();

        expect(scanResp.status()).toBe(201);
        expect(scanBody.type).toBe('compliance.cattle.io.clusterscan');
        expect(scanBody.metadata.name).toBeTruthy();
        expect(scanBody.metadata.generateName).toBe('scan-');

        // Navigate back to compliance list and verify row count
        await expect(page).toHaveURL(/compliance/);

        const complianceResourceTable = new ResourceTablePo(page, '.dashboard-root');

        await expect(complianceResourceTable.self()).toBeVisible();
        await complianceResourceTable.sortableTable().checkRowCount(false, 2);
      });
    });
  });
});
