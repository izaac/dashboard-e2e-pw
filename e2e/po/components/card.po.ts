import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class CardPo extends ComponentPo {
  constructor(page: Page, selector = '[data-testid="card"]') {
    super(page, selector);
  }

  getTitle(): Locator {
    return this.self().getByTestId('card-title-slot');
  }

  getBody(): Locator {
    return this.self().getByTestId('card-body-slot');
  }

  getError(): Locator {
    return this.self().locator('[data-testid="card-body-slot"] > .text-error');
  }

  getActionButton(): Locator {
    return this.self().getByTestId('card-actions-slot');
  }

  /** Get a specific action button by label text */
  actionButtonWithText(text: string): Locator {
    return this.getActionButton().locator('button', { hasText: text });
  }
}
