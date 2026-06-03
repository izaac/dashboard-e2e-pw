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
    await checkbox.waitFor({ state: 'visible' });
    await checkbox.click();
  }

  private input(): Locator {
    return this.self().locator('.checkbox-container');
  }

  /** Locator for the checkbox custom element */
  checkboxCustom(): Locator {
    return this.input().locator('span.checkbox-custom');
  }

  async uncheck(): Promise<void> {
    const ariaChecked = await this.checkboxCustom().getAttribute('aria-checked');

    if (ariaChecked === 'true') {
      await this.set();
    }
  }

  async getCheckboxLabel(): Promise<string> {
    return await this.input().locator('.checkbox-label').innerText();
  }

  async isDisabled(): Promise<boolean> {
    const classAttr = await this.input().getAttribute('class');

    return classAttr?.includes('disabled') ?? false;
  }

  // Use for checkboxes bound to an array v-model (e.g. multi-select groups),
  // where aria-checked is unreliable. These read the real <input> state instead.
  async isInputChecked(): Promise<void> {
    await expect(this.self().locator('input[type="checkbox"]')).toBeChecked();
  }

  async isInputNotChecked(): Promise<void> {
    await expect(this.self().locator('input[type="checkbox"]')).not.toBeChecked();
  }
}
