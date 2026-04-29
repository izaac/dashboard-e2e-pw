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
      .getByTestId('item-card-header-title')
      .filter({ hasText: name })
      .locator('xpath=ancestor::*[contains(@data-testid, "item-card-cluster/")]')
      .first();
  }

  async clickChart(name: string): Promise<void> {
    // The Vue click handler is on the inner [role="link"] div, not the outer card
    await this.getChartByName(name).getByRole('link').click();
  }

  chartCards(): Locator {
    return this.self().getByTestId('app-chart-cards-container').locator('> [data-testid*="item-card-"]');
  }

  headerTitle(): Locator {
    return this.page.getByTestId('charts-header-title');
  }

  emptyState(): Locator {
    return this.self().getByTestId('charts-empty-state');
  }

  emptyStateTitle(): Locator {
    return this.self().getByTestId('charts-empty-state-title');
  }

  emptyStateResetFilters(): Locator {
    return this.self().getByTestId('charts-empty-state-reset-filters');
  }

  async totalChartsCount(): Promise<number> {
    const text = await this.self().getByTestId('charts-total-message').innerText();

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
    return this.self().getByTestId('filter-panel-filter-checkbox').filter({ hasText: name });
  }

  getAllOptionsByGroupName(name: string): Locator {
    return this.self()
      .getByTestId('filter-panel-filter-group')
      .filter({ hasText: name })
      .getByTestId('filter-panel-filter-checkbox');
  }

  scrollContainer(): Locator {
    return this.page.locator('.main-layout');
  }

  sentinel(): Locator {
    return this.self().locator('[data-testid="charts-lazy-load-sentinel"]');
  }
}
