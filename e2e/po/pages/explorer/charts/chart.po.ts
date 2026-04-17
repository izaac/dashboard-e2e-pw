import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import { ChartsPage } from '@/e2e/po/pages/explorer/charts/charts.po';

/**
 * Page object for a single Chart detail/install page.
 */
export class ChartPage extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/apps/charts/chart`;
  }

  private clusterId: string;

  constructor(page: Page, clusterId = 'local') {
    super(page, ChartPage.createPath(clusterId));
    this.clusterId = clusterId;
  }

  /**
   * Navigate to the Charts list, search for a chart by name, and click it.
   * Mirrors upstream Cypress ChartPage.navTo which uses URLSearchParams to
   * verify the query param value (handles both + and %20 encoding).
   */
  async navTo(chartName: string): Promise<void> {
    const chartsPage = new ChartsPage(this.page, this.clusterId);

    await chartsPage.goTo();

    // Wait for charts to finish loading before searching
    await expect(chartsPage.chartCards().first()).toBeVisible({ timeout: 30000 });

    await chartsPage.chartsSearchFilterInput().fill(chartName);

    // Wait for URL to contain the q parameter with the correct value
    await expect(this.page).toHaveURL((url) => {
      const params = new URL(url).searchParams;

      return params.get('q') === chartName;
    });

    // Wait for filtered chart card to appear
    await expect(chartsPage.getChartByName(chartName)).toBeVisible({ timeout: 15000 });
    await chartsPage.clickChart(chartName);
  }

  async waitForChartPage(repository: string, chart: string): Promise<void> {
    await this.waitForPage(`repo-type=cluster&repo=${repository}&chart=${chart}`);
  }

  chartHeader(): Locator {
    return this.self().locator('[data-testid="chart-header-title"]');
  }

  async waitForChartHeader(title: string, timeout = 30000): Promise<void> {
    await expect(this.chartHeader()).toContainText(title, { timeout });
  }

  async goToInstall(): Promise<void> {
    const btn = this.self().locator('.chart-header .btn.role-primary');

    await expect(btn).toBeVisible({ timeout: 15000 });
    await btn.click();
  }
}
