import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class ResourceSearchDialog extends ComponentPo {
  constructor(page: Page) {
    super(page, '[data-testid="search-modal"]');
  }

  searchBox(): Locator {
    return this.self().locator('input.search');
  }

  async close(): Promise<void> {
    await this.page.click('body', { position: { x: 10, y: 10 } });
  }
}
