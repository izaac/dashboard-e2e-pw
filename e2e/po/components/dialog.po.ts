import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class DialogPo extends ComponentPo {
  constructor(page: Page, selector = '#modal-container-element') {
    super(page, selector);
  }

  getActionButton(): Locator {
    return this.self().locator('.dialog-buttons');
  }
}
