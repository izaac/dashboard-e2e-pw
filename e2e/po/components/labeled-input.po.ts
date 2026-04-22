import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class LabeledInputPo extends ComponentPo {
  /**
   * Find a labeled input by its label text within a parent locator
   */
  static byLabel(page: Page, parent: Locator, label: string): LabeledInputPo {
    const selector = `.labeled-input:has-text("${label}") [id^="input-"], .labeled-input:has-text("${label}") input`;

    return new LabeledInputPo(page, selector, parent);
  }

  static bySelector(page: Page, parent: Locator, selector: string): LabeledInputPo {
    return new LabeledInputPo(page, `${selector} input`, parent);
  }

  /**
   * Type value in the input
   */
  async set(value: string): Promise<void> {
    const input = this.input();

    await input.scrollIntoViewIfNeeded();
    await expect(input).toBeVisible();
    await input.focus();
    await input.clear();
    await input.fill(String(value));
  }

  async getAttributeValue(attr: string): Promise<string | null> {
    return this.input().getAttribute(attr);
  }

  async clear(): Promise<void> {
    await this.input().clear();
  }

  async value(): Promise<string> {
    return this.input().inputValue();
  }

  async expectToBeDisabled(): Promise<void> {
    await expect(this.self()).toBeDisabled();
  }

  async expectToBeEnabled(): Promise<void> {
    await expect(this.self()).toBeEnabled();
  }

  input(): Locator {
    return this.self();
  }
}
