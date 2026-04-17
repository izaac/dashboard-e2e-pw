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

  emptyState(): Locator {
    return this.self().locator('[data-testid="charts-empty-state"]');
  }

  emptyStateTitle(): Locator {
    return this.self().locator('[data-testid="charts-empty-state-title"]');
  }

  emptyStateResetFilters(): Locator {
    return this.self().locator('[data-testid="charts-empty-state-reset-filters"]');
  }

  async totalChartsCount(): Promise<number> {
    const text = await this.self().locator('[data-testid="charts-total-message"]').innerText();

    return parseInt(text.match(/\d+/)?.[0] || '0', 10);
  }

  async checkChartGenericIcon(name: string, isGeneric = true): Promise<void> {
    await this.chartsSearchFilterInput().fill(name);
    await expect(this.page).toHaveURL((url) => {
      const params = new URL(url).searchParams;

      return params.get('q') === name;
    });
    await expect(this.chartCards().first()).toBeAttached();

    const card = this.getChartByName(name);
    const src = await card.locator('img').getAttribute('src');

    if (isGeneric) {
      expect(src).toContain('generic-catalog');
    } else {
      expect(src).not.toContain('generic-catalog');
    }

    await this.chartsSearchFilterInput().clear();
    await expect(this.page).toHaveURL((url) => {
      const params = new URL(url).searchParams;

      return params.get('q') === null;
    });
  }

  async resetAllFilters(): Promise<void> {
    await this.chartsSearchFilterInput().clear();
  }

  getFilterOptionByName(name: string): Locator {
    return this.self().locator('.filter-panel .filter-group .filter').filter({ hasText: name });
  }

  getAllOptionsByGroupName(name: string): Locator {
    return this.self().locator('.filter-panel .filter-group').filter({ hasText: name }).locator('.filter');
  }
}
