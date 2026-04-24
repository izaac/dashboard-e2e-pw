import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class CopyToClipboardTextPo extends ComponentPo {
  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  async value(): Promise<string> {
    return this.self().innerText();
  }

  async copyToClipboard(): Promise<void> {
    await this.self().click();
  }
}
