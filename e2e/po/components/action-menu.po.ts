import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class ActionMenuPo extends ComponentPo {
  constructor(page: Page, parent?: Locator) {
    super(page, '[dropdown-menu-collection]', parent);
  }

  /** Locator for a menu item by 0-based index. */
  menuItem(index: number): Locator {
    return this.self().locator('[dropdown-menu-item]').nth(index);
  }

  /** Locator for a menu item by visible label. */
  getMenuItem(label: string): Locator {
    return this.self().locator('[dropdown-menu-item]').filter({ hasText: label });
  }
}
