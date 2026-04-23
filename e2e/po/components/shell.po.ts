import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';

/**
 * Shell PO — matches upstream Cypress Shell component.
 * Used for pod "Execute Shell" actions from the resource list.
 */
export default class ShellPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '#horizontal-window-manager');
  }

  /**
   * Open a terminal for a specific resource by name via the row action menu.
   * Requires a SortableTablePo to scope the action to the correct row.
   */
  async openTerminal(table: SortableTablePo, resourceName: string): Promise<void> {
    const actionMenu = await table.rowActionMenuOpen(resourceName);

    await actionMenu.getMenuItem('Execute Shell').click();
    await expect(this.self().locator('.window.show-grid .text-success')).toContainText('Connected', { timeout: 30000 });
  }

  async closeTerminal(): Promise<void> {
    await this.self().locator('.tab .closer').click();
  }

  async terminalStatus(label: string): Promise<void> {
    await expect(this.self().locator('.status')).toContainText(label);
  }
}
