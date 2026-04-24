import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import { ChartsPage } from '@/e2e/po/pages/explorer/charts/charts.po';
import { SHORT_TIMEOUT_OPT } from '@/support/utils/timeouts';
import { LONG } from '@/support/timeouts';

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
    await chartsPage.chartCards().first().waitFor({ state: 'visible', timeout: LONG });

    await chartsPage.chartsSearchFilterInput().fill(chartName);

    // Wait for URL to contain the q parameter with the correct value
    await this.page.waitForURL((url) => {
      const params = new URL(url).searchParams;

      return params.get('q') === chartName;
    });

    // Wait for filtered chart card to appear
    await chartsPage.getChartByName(chartName).waitFor({ state: 'visible', ...SHORT_TIMEOUT_OPT });
    await chartsPage.clickChart(chartName);
  }

  async waitForChartPage(repository: string, chart: string): Promise<void> {
    await this.waitForPage(`repo-type=cluster&repo=${repository}&chart=${chart}`);
  }

  chartHeader(): Locator {
    return this.self().locator('[data-testid="chart-header-title"]');
  }

  async waitForChartHeader(title: string, timeout = 30000): Promise<void> {
    await this.chartHeader().filter({ hasText: title }).waitFor({ timeout });
  }

  async goToInstall(): Promise<void> {
    const btn = this.self().locator('.chart-header .btn.role-primary');

    await btn.waitFor({ state: 'visible', ...SHORT_TIMEOUT_OPT });
    await btn.click();
  }

  deprecationAndExperimentalWarning(): Locator {
    return this.self().locator('[data-testid="deprecation-and-experimental-banner"]');
  }

  async selectVersion(version: string): Promise<void> {
    await this.self().locator('[data-testid="chart-version-link"]').filter({ hasText: version }).click();
  }

  checkSelectedVersion(version: string): Locator {
    return this.self().locator('.chart-body__info-section--versions .current-version').filter({ hasText: version });
  }

  versions(): Locator {
    return this.self().locator('[data-testid="chart-versions"]');
  }

  versionLinks(): Locator {
    return this.versions().locator('[data-testid="chart-version-link"]');
  }

  showMoreVersions(): Locator {
    return this.self().locator('[data-testid="chart-show-more-versions"]');
  }

  repoLink(): Locator {
    return this.self().locator('[data-testid="chart-repo-link"]');
  }

  keywords(): Locator {
    return this.self().locator('[data-testid="chart-keyword-link"]');
  }

  async getVersions(): Promise<string[]> {
    const elements = this.self().locator('.chart-body__info-section--versions b');
    const count = await elements.count();
    const versions: string[] = [];

    for (let i = 0; i < count; i++) {
      versions.push(await elements.nth(i).innerText());
    }

    return versions;
  }
}
