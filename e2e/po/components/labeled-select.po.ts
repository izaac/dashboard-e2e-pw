import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class LabeledSelectPo extends ComponentPo {
  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  /**
   * Locator for the dropdown toggle. Vue-select renders two nested combobox roles:
   * the Rancher wrapper (unlabeled-select/labeled-select) and the inner
   * `vs__dropdown-toggle`. `.first()` targets the outer one, which propagates
   * mousedown to vue-select's toggleDropdown handler.
   */
  dropdown(): Locator {
    return this.self().getByRole('combobox').first();
  }

  /** Locator for the search input inside the dropdown (caller uses `.fill(value)`). */
  searchInput(): Locator {
    return this.self().locator('input[type="search"]');
  }

  /** Locator for an option by 1-based DOM index. */
  optionByIndex(index: number): Locator {
    return this.page.locator(`.vs__dropdown-menu .vs__dropdown-option:nth-child(${index})`);
  }

  /** Locator for an option matching a label exactly (`^label $` regex; preserves the Rancher trailing-space convention). */
  optionByLabel(label: string): Locator {
    const labelRegex = new RegExp(`^${label} $`);

    return this.getOptions().filter({ hasText: labelRegex });
  }

  /** Locator for the deselect button next to a currently selected item. */
  deselectButton(label: string): Locator {
    return this.self().locator('span.vs__selected').filter({ hasText: label }).locator('button.vs__deselect');
  }

  /** Type into the search input and click the first matching option — orchestration kept. */
  async setOptionAndClick(label: string): Promise<void> {
    await this.searchInput().fill(label);
    await this.optionByIndex(1).click();
  }

  /** Click an option whose visible text contains `label` (substring match). */
  async clickOptionWithLabel(label: string): Promise<void> {
    await this.getOptions().filter({ hasText: label }).first().click();
  }

  /** Locator for the currently selected option */
  selectedOption(): Locator {
    return this.self().locator('.vs__selected-options > span.vs__selected');
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
    await this.getOptions().first().waitFor({ state: 'attached' });
  }

  /** Check dropdown is closed */
  async isClosed(): Promise<void> {
    await this.getOptions().first().waitFor({ state: 'detached' });
  }

  static byLabel(page: Page, parent: Locator, label: string): LabeledSelectPo {
    const container = parent.locator(`label:has-text("${label}")`).locator('..').locator('+ .v-select');

    return new LabeledSelectPo(page, ':scope', container);
  }
}
