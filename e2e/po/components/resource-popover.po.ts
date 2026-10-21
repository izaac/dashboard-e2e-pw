import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

const CARD = '.popover-card';

/**
 * A lazy resource popover. The card renders in a page-level popper portal,
 * so card content is always resolved from the page rather than the trigger.
 */
export default class ResourcePopoverPo extends ComponentPo {
  constructor(page: Page, parent?: Locator) {
    super(page, '.resource-popover', parent);
  }

  /** Hoverable/clickable trigger wrapping the resource name. */
  target(): Locator {
    return this.self().locator('.popover-card-target');
  }

  /** Keyboard-focusable chevron that opens the card. */
  focusButton(): Locator {
    return this.self().locator('.focus-button');
  }

  card(): Locator {
    return this.page.locator(CARD).first();
  }

  readyIndicator(): Locator {
    return this.card().locator('.ready-indicator');
  }

  /** A labelled glance row, e.g. "Pod IP" or "Internal IP". */
  row(label: string): Locator {
    return this.card().locator('.row').filter({ hasText: label }).first();
  }

  usage(): Locator {
    return this.card().getByTestId('resource-popover-usage');
  }

  usageItem(name: 'cpu' | 'memory' | 'pods'): Locator {
    return this.card().getByTestId(`resource-popover-usage-${name}`);
  }

  loading(): Locator {
    return this.card().getByTestId('resource-popover-loading');
  }

  error(): Locator {
    return this.card().getByTestId('resource-popover-error');
  }
}
