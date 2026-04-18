import type { Locator } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Represents a single row in a sortable table.
 * Wraps a Locator pointing to the <tr> element.
 */
export default class ListRowPo {
  private rowLocator: Locator;

  constructor(rowLocator: Locator) {
    this.rowLocator = rowLocator;
  }

  self(): Locator {
    return this.rowLocator;
  }

  column(index: number): Locator {
    return this.rowLocator.locator(`td`).nth(index);
  }

  actionBtn(): Locator {
    return this.rowLocator.locator('[data-testid*="action-button"]');
  }

  get(selector: string): Locator {
    return this.rowLocator.locator(selector);
  }

  async checkVisible(): Promise<void> {
    await expect(this.rowLocator).toBeVisible();
  }

  async checkNotVisible(): Promise<void> {
    await expect(this.rowLocator).not.toBeVisible();
  }
}
