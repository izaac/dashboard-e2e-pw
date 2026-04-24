import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class SlideInPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '[data-testid="slide-in-panel-resource-explain"]');
  }

  async waitforContent(): Promise<void> {
    const panel = this.self().locator('.explain-panel');

    await panel.waitFor({ state: 'visible' });
    await this.self().locator('.icon-spinner').waitFor({ state: 'detached' });
    await this.self().locator('.markdown').waitFor({ state: 'visible' });
  }

  closeButton(): Locator {
    return this.self().locator('[data-testid="slide-in-panel-close-resource-explain"]');
  }
}
