import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';

export default class ClusterToolsPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/tools`;
  }

  constructor(page: Page, clusterId: string) {
    super(page, ClusterToolsPagePo.createPath(clusterId));
  }

  featureChartCards(): Locator {
    return this.page.locator('[data-testid="tools-app-chart-cards"]').locator('[data-testid*="item-card-"]');
  }

  getCardByName(chartName: string): Locator {
    // Find the title element first, then navigate up to the card container.
    // Using hasText on item-card-* matches child elements too (strict mode violation).
    return this.page
      .locator('[data-testid="item-card-header-title"]')
      .filter({ hasText: chartName })
      .locator('xpath=ancestor::div[starts-with(@data-testid, "item-card-cluster/")]');
  }

  private async clickAction(chartName: string, actionLabel: string): Promise<void> {
    const card = this.getCardByName(chartName);

    await expect(card).toBeVisible({ timeout: 30000 });

    // Open the action menu dropdown
    await card.locator('[data-testid="item-card-header-action-menu"]').click();

    // Click the menu item by label in the popover/dropdown
    await this.page.locator('[dropdown-menu-item]').filter({ hasText: actionLabel }).click();
  }

  async deleteChart(chartName: string): Promise<void> {
    await this.clickAction(chartName, 'Remove');
  }

  async goToInstall(chartName: string): Promise<void> {
    await this.clickAction(chartName, 'Install');
  }

  async editChart(chartName: string): Promise<void> {
    await this.clickAction(chartName, 'Edit current version');
  }

  getChartVersion(name: string): Locator {
    return this.getCardByName(name).locator('[data-testid="app-chart-card-sub-header-item"]').first();
  }
}
