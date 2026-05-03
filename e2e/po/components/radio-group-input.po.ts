import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class RadioGroupInputPo extends ComponentPo {
  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  async set(value: number): Promise<void> {
    await this.self().locator('.radio-label').nth(value).click();
  }

  async isChecked(value: number): Promise<void> {
    await expect(this.self().locator('.radio-container > span').nth(value)).toHaveAttribute('aria-checked', 'true');
  }

  getAllOptions(): Locator {
    return this.self().locator('.radio-label');
  }

  getOptionByIndex(index: number): Locator {
    return this.self().locator('.radio-label').nth(index);
  }

  /** Locator for a radio span by visible label (caller asserts aria-checked attribute). */
  radioSpanByLabel(label: string): Locator {
    return this.self().locator('.radio-container').filter({ hasText: label }).locator('> span').first();
  }
}
