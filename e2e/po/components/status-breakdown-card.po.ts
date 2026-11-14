import type { Locator, Page } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

/**
 * The "Other, Unhealthy Workloads" card of the Cluster Dashboard resource status group: one row per
 * resource type with its counts per state color, or an empty message when nothing is unhealthy.
 */
export default class StatusBreakdownCardPo extends ComponentPo {
  constructor(page: Page, parent?: Locator) {
    super(page, '[data-testid="status-breakdown-card"]', parent);
  }

  /** The "No other unhealthy workloads" message shown when there are no rows */
  emptyMessage(): Locator {
    return this.self().locator('.empty span.text-deemphasized');
  }

  rows(): Locator {
    return this.self().locator('li.breakdown-row');
  }

  /** The row of a resource type, matched on its exact label (e.g. "Jobs", "Pods") */
  row(label: string): Locator {
    return this.rows().filter({
      has: this.page.locator('.label', { hasText: new RegExp(`^\\s*${label}\\s*$`) }),
    });
  }

  /** Count link of a row and state color, e.g. countLink('Jobs', 1, 'Error') matches aria-label "1 Jobs, Error" */
  countLink(label: string, count: number, color: string): Locator {
    return this.self().locator(`a.count[aria-label="${count} ${label}, ${color}"]`);
  }

  async clickCount(label: string, count: number, color: string): Promise<void> {
    await this.countLink(label, count, color).click();
  }
}
