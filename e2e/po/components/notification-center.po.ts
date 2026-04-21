import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import { NotificationPo } from '@/e2e/po/components/notification.po';

export default class NotificationsCenterPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '[data-testid="notifications-center-panel"]');
  }

  dropdownButton(): Locator {
    return this.page.getByTestId('notifications-center');
  }

  /** Open/close the notification center */
  async toggle(): Promise<void> {
    await this.dropdownButton().click();
    await this.page.waitForTimeout(500);
  }

  /** Check that the indicator shows there are no unread notifications */
  async checkAllRead(): Promise<void> {
    await expect(this.page.getByTestId('notifications-center-status')).toBeAttached();
    await expect(this.page.getByTestId('notifications-center-statusunread')).not.toBeAttached();
  }

  /** Check that the indicator shows there are unread notifications */
  async checkHasUnread(): Promise<void> {
    await expect(this.page.getByTestId('notifications-center-status')).not.toBeAttached();
    await expect(this.page.getByTestId('notifications-center-statusunread')).toBeAttached();
  }

  async checkOpen(): Promise<void> {
    await expect(this.page.locator('[data-testid="notifications-center"][aria-expanded="true"]')).toBeAttached();
  }

  async checkClosed(): Promise<void> {
    await expect(this.page.locator('[data-testid="notifications-center"][aria-expanded="false"]')).toBeAttached();
  }

  /** Get a notification by selector name */
  getNotificationByName(selectorName: string): NotificationPo {
    const selector = `[data-testid^="notifications-center-item-${selectorName}"]`;

    return new NotificationPo(this.page, selector);
  }

  /** Mark all notifications as read */
  async markAllRead(): Promise<void> {
    await this.page.getByTestId('notifications-center-markall-read').click({ force: true });
  }

  /** Check the number of notifications */
  async checkCount(count: number): Promise<void> {
    await expect(this.self().getByTestId('notifications-center-item')).toHaveCount(count);
  }

  /** Assert at least `min` notifications (exact count may vary). */
  async checkCountAtLeast(min: number): Promise<void> {
    await expect(async () => {
      const count = await this.self().getByTestId('notifications-center-item').count();

      expect(count).toBeGreaterThanOrEqual(min);
    }).toPass();
  }

  /** Get a notification by ID */
  getNotification(id: string): NotificationPo {
    const selector = `[data-testid="notifications-center-item-${id}"]`;

    return new NotificationPo(this.page, selector);
  }

  /** Get a notification by index */
  getNotificationByIndex(index: number): NotificationPo {
    const selector = `[data-testid="notifications-center-item"]:nth-child(${index + 1})`;

    return new NotificationPo(this.page, selector);
  }
}
