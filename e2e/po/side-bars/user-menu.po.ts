import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export type UserMenuLabel = "What's New" | 'Preferences' | 'Account & API Keys' | 'Log Out';

export default class UserMenuPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '[data-testid="nav_header_showUserMenu"]');
  }

  userMenuContainer(): Locator {
    return this.page.locator('[dropdown-menu-collection]');
  }

  async open(): Promise<void> {
    await this.page.getByTestId('nav_header_showUserMenu').click();
  }

  async isOpen(): Promise<void> {
    await this.userMenuContainer().waitFor({ state: 'visible' });
  }

  async ensureOpen(): Promise<void> {
    await this.self().waitFor({ state: 'visible' });

    const alreadyOpen = await this.userMenuContainer().isVisible();

    if (!alreadyOpen) {
      await this.open();
    }

    await this.isOpen();
  }

  async isClosed(): Promise<void> {
    await this.userMenuContainer().waitFor({ state: 'detached' });
  }

  getMenuItems(): Locator {
    return this.userMenuContainer().locator('[dropdown-menu-item]');
  }

  async getMenuItem(label: UserMenuLabel): Promise<Locator> {
    await this.ensureOpen();
    const items = this.userMenuContainer().locator('[dropdown-menu-item]');

    return items.filter({ hasText: label });
  }

  async clickMenuItem(label: UserMenuLabel): Promise<void> {
    const item = await this.getMenuItem(label);

    await item.click();
  }
}
