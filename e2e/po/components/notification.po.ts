import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export class NotificationPo extends ComponentPo {
  constructor(page: Page, selector: string) {
    super(page, selector);
  }

  async toggleRead(): Promise<void> {
    // eslint-disable-next-line playwright/no-force-option -- read-indicator is a tiny dot inside the notification row; click target can be obscured by hover overlay
    await this.self().locator('.read-indicator').click({ force: true });
  }

  /** Locator for the unread indicator icon */
  readIcon(): Locator {
    return this.self().locator('div.read-icon.unread');
  }

  title(): Locator {
    return this.self().locator('.item-title');
  }

  primaryActionButton(): Locator {
    return this.self().locator('.role-primary');
  }

  secondaryActionButton(): Locator {
    return this.self().locator('.role-secondary');
  }
}
