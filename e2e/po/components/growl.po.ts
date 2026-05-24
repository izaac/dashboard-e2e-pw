import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

/**
 * Growl (toast) notifications shown in the bottom-right of the dashboard.
 * Lifecycle: appears on action success/failure, auto-dismisses after ~3s.
 *
 * Usage:
 *   const growl = new Growl(page);
 *   await expect(growl.byText('Copied KubeConfig to Clipboard')).toBeVisible();
 *   await expect(growl.byText('Copied KubeConfig to Clipboard')).toHaveCount(0, { timeout: 4_000 });
 */
export default class Growl extends ComponentPo {
  constructor(page: Page, parent?: Locator) {
    super(page, '.growl-list', parent);
  }

  /** All currently-visible growl items. */
  items(): Locator {
    return this.self().locator('.growl-text');
  }

  /** A specific growl item by visible text content. */
  byText(text: string): Locator {
    return this.items().filter({ hasText: text });
  }
}
