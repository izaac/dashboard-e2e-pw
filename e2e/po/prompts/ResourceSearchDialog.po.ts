import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class ResourceSearchDialog extends ComponentPo {
  constructor(page: Page) {
    super(page, '[data-testid="search-modal"]');
  }

  async waitForNoDialog(): Promise<void> {
    await expect(this.self()).not.toBeAttached();
  }

  async open(): Promise<void> {
    await this.page.keyboard.press('Meta+k');
  }

  searchBox(): Locator {
    return this.self().locator('input.search');
  }

  results(): Locator {
    return this.self().locator('.results li.child .label');
  }

  async close(): Promise<void> {
    await this.page.click('body', { position: { x: 10, y: 10 } });
  }

  static async goToResource(page: Page, name: string): Promise<void> {
    const dialog = new ResourceSearchDialog(page);

    await dialog.open();
    await dialog.checkExists();
    await dialog.checkVisible();

    await dialog.searchBox().fill(name);
    await expect(dialog.results()).toHaveCount(1);
    await expect(dialog.results().first()).toHaveText(name);
    await dialog.results().first().click();
  }
}
