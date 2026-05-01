import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class CheckboxInputPo extends ComponentPo {
  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  static byLabel(page: Page, parent: Locator, label: string): CheckboxInputPo {
    return new CheckboxInputPo(page, `.checkbox-outer-container:has(.checkbox-label:has-text("${label}"))`, parent);
  }

  async set(): Promise<void> {
    const checkbox = this.self().locator('.checkbox-custom');

    await checkbox.scrollIntoViewIfNeeded();
    await expect(checkbox).toBeVisible();
    await checkbox.click();
  }

  private input(): Locator {
    return this.self().locator('.checkbox-container');
  }

  /** Locator for the checkbox custom element */
  checkboxCustom(): Locator {
    return this.input().locator('span.checkbox-custom');
  }

  async isChecked(): Promise<void> {
    await expect(this.input().locator('span.checkbox-custom')).toHaveAttribute('aria-checked', 'true');
  }

  async isNotChecked(): Promise<void> {
    await expect(this.input().locator('span.checkbox-custom')).toHaveAttribute('aria-checked', 'false');
  }

  async uncheck(): Promise<void> {
    const ariaChecked = await this.input().locator('span.checkbox-custom').getAttribute('aria-checked');

    if (ariaChecked === 'true') {
      await this.set();
    }
  }

  async hasAppropriateWidth(): Promise<void> {
    const width = await this.input()
      .locator('span.checkbox-custom')
      .evaluate((el) => getComputedStyle(el).width);

    expect(width).toMatch(/14.*px/);
  }

  async hasAppropriateHeight(): Promise<void> {
    const height = await this.input()
      .locator('span.checkbox-custom')
      .evaluate((el) => getComputedStyle(el).height);

    expect(height).toMatch(/14.*px/);
  }

  async isUnchecked(): Promise<void> {
    await expect(this.input().locator('span.checkbox-custom')).not.toHaveAttribute('aria-checked', 'true');
  }

  async getCheckboxLabel(): Promise<string> {
    return await this.input().locator('.checkbox-label').innerText();
  }

  async isDisabled(): Promise<boolean> {
    const classAttr = await this.input().getAttribute('class');

    return classAttr?.includes('disabled') ?? false;
  }

  async checkDisabled(): Promise<void> {
    await expect(this.input()).toHaveClass(/disabled/);
  }
}
