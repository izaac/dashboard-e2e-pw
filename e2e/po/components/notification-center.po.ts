import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import { NotificationPo } from '@/e2e/po/components/notification.po';
import { waitForAnimationSettle } from '@/support/utils/debounce';

export default class NotificationsCenterPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '[data-testid="notifications-center-panel"]');
  }

  dropdownButton(): Locator {
    return this.page.getByTestId('notifications-center');
  }

  /**
   * Open/close the notification center. Waits for the slide-in panel's
   * CSS transition to actually settle via the Web Animations API rather
   * than an `aria-expanded` race (the attribute flip is debounced behind
   * the animation on post-restart pages, where the prior `waitForTimeout(500)`
   * sleep masked it).
   */
  async toggle(): Promise<void> {
    await this.dropdownButton().click();
    await waitForAnimationSettle(this.self(), 'notification-center toggle');
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
