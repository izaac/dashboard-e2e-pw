import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';

/**
 * Page object for the Charts list page.
 */
export class ChartsPage extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/apps/charts`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, ChartsPage.createPath(clusterId));
  }

  chartsSearchFilterInput(): Locator {
    return this.self().getByTestId('charts-filter-input');
  }

  /**
   * Find a chart card by its title text.
   * Mirrors upstream: RcItemCardPo.getCardByTitle — finds the title element
   * first, then traverses up to the parent card to avoid strict mode violations.
   */
  getChartByName(name: string): Locator {
    return this.self()
      .locator('[data-testid="item-card-header-title"]')
      .filter({ hasText: name })
      .locator('xpath=ancestor::*[contains(@data-testid, "item-card-cluster/")]')
      .first();
  }

  async clickChart(name: string): Promise<void> {
    await this.getChartByName(name).click();
  }

  chartCards(): Locator {
    return this.self().locator('[data-testid="app-chart-cards-container"] > [data-testid*="item-card-"]');
  }

  headerTitle(): Locator {
    return this.page.getByTestId('charts-header-title');
  }
}
