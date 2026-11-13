import { test, expect } from '@/support/fixtures';
import { ChartsPage } from '@/e2e/po/pages/explorer/charts/charts.po';
import ChartInstalledAppsListPagePo from '@/e2e/po/pages/chart-installed-apps.po';
import { LONG } from '@/support/timeouts';

const INITIAL_CHART_VERSION = '1.0.0';
const UPDATED_CHART_VERSION = '2.0.0';

test.describe('Apps / Charts / Installed Apps Watch', { tag: ['@explorer', '@adminUser', '@charts'] }, () => {
  test('leaving Charts page unwatches apps so Installed Apps list remains populated on app change', async ({
    page,
    login,
    rancherApi,
  }) => {
    const testAppName = `qa-app-${Date.now()}`;

    await rancherApi.createRancherResource('v1', 'catalog.cattle.io.apps', {
      type: 'catalog.cattle.io.app',
      metadata: {
        name: testAppName,
        namespace: 'default',
        labels: { 'qa-issue': '19576' },
      },
      spec: {
        chart: {
          metadata: {
            name: 'qa-test-chart',
            version: INITIAL_CHART_VERSION,
          },
        },
        name: testAppName,
        namespace: 'default',
        info: { status: 'deployed' },
      },
    });

    try {
      await login();

      const chartsPage = new ChartsPage(page);
      const installedAppsPage = new ChartInstalledAppsListPagePo(page);

      // 1. Navigate to Charts page (starts catalog.cattle.io.app watch)
      await chartsPage.goTo();
      await chartsPage.waitForPage();
      await expect(chartsPage.chartCards().first()).toBeVisible({ timeout: LONG });

      // 2. Navigate in-app via sidebar to Installed Apps (triggers Charts beforeUnmount without reloading SPA)
      await chartsPage.navToSideMenuEntryByLabel('Installed Apps');
      await installedAppsPage.waitForPage();

      const sortableTable = installedAppsPage.appsList().sortableTable();
      const testAppRow = sortableTable.rowWithName(testAppName);

      await expect(testAppRow.self()).toBeVisible({ timeout: LONG });
      await expect(testAppRow.self()).toContainText(INITIAL_CHART_VERSION, { timeout: LONG });

      // Record any transient flash of the empty-state row while the WebSocket update arrives
      await page.evaluate(() => {
        const win = window as unknown as { __sawNoRowsFlash: boolean; __noRowsObserver?: MutationObserver };
        const tbody = document.querySelector('.sortable-table tbody');

        win.__sawNoRowsFlash = Boolean(tbody?.querySelector('.no-rows'));

        if (tbody) {
          win.__noRowsObserver = new MutationObserver(() => {
            if (tbody.querySelector('.no-rows')) {
              win.__sawNoRowsFlash = true;
            }
          });
          win.__noRowsObserver.observe(tbody, { childList: true, subtree: true });
        }
      });

      // 3. Mutate a visible field on the app so we prove the WebSocket update actually reached the UI
      const currentApp = await rancherApi.getRancherResource('v1', 'catalog.cattle.io.apps', `default/${testAppName}`);

      currentApp.body.spec.chart.metadata.version = UPDATED_CHART_VERSION;
      await rancherApi.updateRancherResource('v1', 'catalog.cattle.io.apps', `default/${testAppName}`, currentApp.body);

      // 4. Verify the live WebSocket update renders in the table and never flashes "There are no rows to show"
      await expect(testAppRow.self()).toContainText(UPDATED_CHART_VERSION, { timeout: LONG });
      await expect(sortableTable.noRowsText()).toBeHidden();

      const sawNoRowsFlash = await page.evaluate(() => {
        const win = window as unknown as { __sawNoRowsFlash: boolean; __noRowsObserver?: MutationObserver };

        win.__noRowsObserver?.disconnect();

        return win.__sawNoRowsFlash;
      });

      expect(sawNoRowsFlash).toBe(false);

      // 5. Navigate in-app back to Charts and confirm charts reload cleanly
      await installedAppsPage.navToSideMenuEntryByLabel('Charts');
      await chartsPage.waitForPage();
      await expect(chartsPage.chartCards().first()).toBeVisible({ timeout: LONG });
    } finally {
      await rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.apps', `default/${testAppName}`, false);
    }
  });
});
