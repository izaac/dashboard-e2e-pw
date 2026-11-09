import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

/** State badge (`.badge-state`), optionally scoped to a parent locator */
export default class StateBadgePo extends ComponentPo {
  constructor(page: Page, parent?: Locator, selector = '.badge-state') {
    super(page, selector, parent);
  }

  /** All state badges within scope. */
  badges(): Locator {
    return this.self();
  }

  /** First state badge within scope. */
  firstBadge(): Locator {
    return this.badges().first();
  }
}
