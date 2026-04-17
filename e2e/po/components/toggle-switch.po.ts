import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class ToggleSwitchPo extends ComponentPo {
  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  async toggle(): Promise<void> {
    await this.self().click();
  }

  async value(): Promise<string> {
    return ((await this.self().locator('span.active').textContent()) || '').trim();
  }

  async set(label: string): Promise<void> {
    const current = await this.value();

    if (current !== label) {
      await this.toggle();
    }

    const newValue = await this.value();

    expect(newValue).toEqual(label);
  }
}
