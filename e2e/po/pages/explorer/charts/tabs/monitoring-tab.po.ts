import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export class MonitoringTab extends ComponentPo {
  constructor(page: Page, selector = '.dashboard-root', parent?: Locator) {
    super(page, selector, parent);
  }

  async scrollToTabBottom(): Promise<void> {
    await this.page
      .locator('.main-layout > .outlet > .outer-container')
      .evaluate((el) => el.scrollTo(0, el.scrollHeight));
  }
}
