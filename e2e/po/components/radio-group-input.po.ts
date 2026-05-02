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

  /** Locator for a radio option's `aria-checked` span by visible label —
   *  more resilient than index-based access when the rendering order changes. */
  radioSpanByLabel(label: string): Locator {
    return this.self().locator('.radio-container').filter({ hasText: label }).locator('> span').first();
  }

  getAllOptions(): Locator {
    return this.self().locator('.radio-label');
  }

  getOptionByIndex(index: number): Locator {
    return this.self().locator('.radio-label').nth(index);
  }
}
