import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

/** Resource card rows (state dots, etc.) rendered on resource detail pages */
export default class ResourceCardPo extends ComponentPo {
  constructor(page: Page, selector = '.resource-rows', parent?: Locator) {
    super(page, selector, parent);
  }

  /** All state dots rendered in the card rows. */
  stateDots(): Locator {
    return this.self().locator('.state-dot');
  }

  /** First state dot rendered in the card rows. */
  firstStateDot(): Locator {
    return this.stateDots().first();
  }
}
