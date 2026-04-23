import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

/**
 * Shell PO — matches upstream Cypress Shell component.
 * Used for pod "Execute Shell" actions from the resource list.
 */
export default class ShellPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '#horizontal-window-manager');
  }

  async openTerminal(): Promise<void> {
    await this.page.getByTestId('sortable-table-0-action-button').first().click();
    await this.page.locator('[dropdown-menu-item]').filter({ hasText: 'Execute Shell' }).click();
    await expect(this.self().locator('.window.show-grid .text-success')).toContainText('Connected', { timeout: 30000 });
  }

  async closeTerminal(): Promise<void> {
    await this.self().locator('.tab .closer').click();
  }

  async terminalStatus(label: string): Promise<void> {
    await expect(this.self().locator('.status')).toContainText(label);
  }
}
