import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class UnitInputPo extends ComponentPo {
  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  async setValue(value: string | number): Promise<void> {
    const input = this.self().locator('input');

    await input.focus();
    await input.clear();
    await input.fill(String(value));
  }

  async clear(): Promise<void> {
    await this.self().locator('input').clear();
  }
}
