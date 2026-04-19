import type { Page, Locator } from '@playwright/test';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import ListRowPo from '@/e2e/po/components/list-row.po';
import ActionMenuPo from '@/e2e/po/components/action-menu.po';

export default class MgmtFeatureFlagListPo extends BaseResourceList {
  constructor(page: Page, parent?: Locator) {
    super(page, ':scope', parent);
  }

  elements(): Locator {
    return this.resourceTable().sortableTable().rowElements();
  }

  elementWithName(name: string): Locator {
    return this.resourceTable().sortableTable().rowElementWithName(name);
  }

  /** Find the row for a feature flag by exact name (plain text in <td>, no wrapping <a>/<span>) */
  private rowByExactName(name: string): Locator {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exactRegex = new RegExp(`^\\s*${escaped}\\s*$`);

    return this.resourceTable()
      .sortableTable()
      .self()
      .locator('tbody tr')
      .filter({
        has: this.page.locator('td').filter({ hasText: exactRegex }),
      });
  }

  details(name: string, index: number): Locator {
    return new ListRowPo(this.rowByExactName(name)).column(index);
  }

  async clickRowActionMenuItem(name: string, itemLabel: string): Promise<void> {
    // Feature flag names are plain text in <td> cells — use exact row match for action button
    const row = new ListRowPo(this.rowByExactName(name));

    await row.actionBtn().click();

    const actionMenu = new ActionMenuPo(this.page);

    await actionMenu.getMenuItem(itemLabel).click();
  }

  async getRowActionMenuItem(name: string, itemLabel: string): Promise<Locator> {
    const row = new ListRowPo(this.rowByExactName(name));

    await row.actionBtn().click();

    const actionMenu = new ActionMenuPo(this.page);

    return actionMenu.getMenuItem(itemLabel);
  }

  async getRowNoActionMenu(name: string): Promise<Locator> {
    const row = new ListRowPo(this.rowByExactName(name));

    await row.actionBtn().click();

    const actionMenu = new ActionMenuPo(this.page);

    return actionMenu.getMenuItem('No actions available');
  }
}
