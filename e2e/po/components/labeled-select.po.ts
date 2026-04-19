import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class LabeledSelectPo extends ComponentPo {
  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  async toggle(): Promise<void> {
    await this.self().click();
  }

  async setOptionAndClick(label: string): Promise<void> {
    await this.self().locator('input[type="search"]').fill(label);
    await this.clickOption(1);
  }

  async clickOption(optionIndex: number): Promise<void> {
    await this.page.locator(`.vs__dropdown-menu .vs__dropdown-option:nth-child(${optionIndex})`).click();
  }

  async clickOptionWithLabel(label: string): Promise<void> {
    const options = this.getOptions();
    const option = options.filter({ hasText: label });

    await option.first().click();
  }

  async clickLabel(label: string): Promise<void> {
    const labelRegex = new RegExp(`^${label} $`);

    await this.getOptions().filter({ hasText: labelRegex }).click();
  }

  async checkOptionSelected(label: string): Promise<void> {
    const selected = this.self().locator('.vs__selected-options > span.vs__selected');

    await expect(selected).toHaveText(label, { useInnerText: true });
  }

  async checkContainsOptionSelected(label: string): Promise<void> {
    const selected = this.self().locator('.vs__selected-options > span.vs__selected');

    await expect(selected).toContainText(label);
  }

  getOptions(): Locator {
    return this.page.locator('.vs__dropdown-menu > li');
  }

  /** Get dropdown options as string values */
  async getOptionsAsStrings(): Promise<string[]> {
    const options = this.getOptions();
    const count = await options.count();
    const result: string[] = [];

    for (let i = 0; i < count; i++) {
      result.push((await options.nth(i).innerText()).trim());
    }

    return result;
  }

  /** Check dropdown is open */
  async isOpened(): Promise<void> {
    await expect(this.getOptions().first()).toBeAttached();
  }

  /** Check dropdown is closed */
  async isClosed(): Promise<void> {
    await expect(this.getOptions()).not.toBeAttached();
  }

  /** Filter list by typing name */
  async filterByName(name: string): Promise<void> {
    await this.self().locator('input[type="search"]').fill(name);
  }

  /** Click the deselect button for a selected item */
  async clickDeselectButton(label: string): Promise<void> {
    const selectedItem = this.self().locator('span.vs__selected').filter({ hasText: label });

    await selectedItem.locator('button.vs__deselect').click();
  }

  static byLabel(page: Page, parent: Locator, label: string): LabeledSelectPo {
    const container = parent.locator(`label:has-text("${label}")`).locator('..').locator('+ .v-select');

    return new LabeledSelectPo(page, '.v-select', container);
  }
}
