import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

/**
 * Fail Whale component page object.
 * Used both as the full fail-whale page and in-context in place of a resource list
 * when the resource type is unknown.
 */
export default class FailWhalePo extends ComponentPo {
  constructor(page: Page) {
    super(page, '[data-testid="fail-whale"]');
  }

  title(): Locator {
    return this.self().locator('h1');
  }

  message(): Locator {
    return this.self().locator('h2');
  }
}
