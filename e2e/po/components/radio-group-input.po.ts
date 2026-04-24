import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class RadioGroupInputPo extends ComponentPo {
  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  async set(value: number): Promise<void> {
    await this.self().locator('.radio-label').nth(value).click();
  }

  /** Locator for a radio option by index */
  radioSpan(value: number): Locator {
    return this.self().locator('.radio-container > span').nth(value);
  }

  getAllOptions(): Locator {
    return this.self().locator('.radio-label');
  }

  getOptionByIndex(index: number): Locator {
    return this.self().locator('.radio-label').nth(index);
  }
}
