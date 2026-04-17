import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class PasswordPo extends ComponentPo {
  async set(value: string): Promise<void> {
    const input = this.input();

    await input.focus();
    await input.fill(value);
  }

  private input(): Locator {
    return this.self().locator('input');
  }

  showBtn(): Locator {
    return this.self().locator('.addon a');
  }
}
