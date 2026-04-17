import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class ActionMenuPo extends ComponentPo {
  constructor(page: Page, parent?: Locator) {
    super(page, '[dropdown-menu-collection]', parent);
  }

  async clickMenuItem(index: number): Promise<void> {
    await this.self().locator('[dropdown-menu-item]').nth(index).click();
  }

  getMenuItem(label: string): Locator {
    return this.self().locator('[dropdown-menu-item]').filter({ hasText: label });
  }
}
