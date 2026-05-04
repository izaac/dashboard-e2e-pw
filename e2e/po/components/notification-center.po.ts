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

  /** Open/close the notification center. Waits for the panel's aria-expanded
   *  attribute to flip to the opposite of its pre-click value, replacing the
   *  prior fixed 500 ms sleep with a web-first attribute assertion. */
  async toggle(): Promise<void> {
    const before = (await this.dropdownButton().getAttribute('aria-expanded')) ?? 'false';
    const expected = before === 'true' ? 'false' : 'true';

    await this.dropdownButton().click();
    await expect(this.dropdownButton()).toHaveAttribute('aria-expanded', expected);
  }

  /** Status indicator locator (read state) */
  statusIndicator(): Locator {
    return this.page.getByTestId('notifications-center-status');
  }

  /** Unread indicator locator */
  unreadIndicator(): Locator {
    return this.page.getByTestId('notifications-center-statusunread');
  }

  /** Expanded state locator */
  expandedState(): Locator {
    return this.page.locator('[data-testid="notifications-center"][aria-expanded="true"]');
  }

  /** Collapsed state locator */
  collapsedState(): Locator {
    return this.page.locator('[data-testid="notifications-center"][aria-expanded="false"]');
  }

  /** Get a notification by selector name */
  getNotificationByName(selectorName: string): NotificationPo {
    const selector = `[data-testid^="notifications-center-item-${selectorName}"]`;

    return new NotificationPo(this.page, selector);
  }

  /** Mark all notifications as read */
  async markAllRead(): Promise<void> {
    // eslint-disable-next-line playwright/no-force-option -- "mark all" lives inside the slide-in panel which can intercept normal clicks while the panel is still settling
    await this.page.getByTestId('notifications-center-markall-read').click({ force: true });
  }

  /** All notification items */
  items(): Locator {
    return this.self().getByTestId('notifications-center-item');
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
