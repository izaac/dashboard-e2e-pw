import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export class NotificationPo extends ComponentPo {
  constructor(page: Page, selector: string) {
    super(page, selector);
  }

  async toggleRead(): Promise<void> {
    await this.self().locator('.read-indicator').click({ force: true });
  }

  async checkRead(): Promise<void> {
    await expect(this.self().locator('div.read-icon.unread')).not.toBeAttached();
  }

  async checkUnread(): Promise<void> {
    await expect(this.self().locator('div.read-icon.unread')).toBeAttached();
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
