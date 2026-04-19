import type { Page, Locator } from '@playwright/test';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';

export default class ButtonDropdownPo extends LabeledSelectPo {
  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  async toggle(): Promise<void> {
    await this.self().getByTestId('dropdown-button').click();
  }
}
