import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import ActionMenuPo from '@/e2e/po/components/action-menu.po';
import ListRowPo from '@/e2e/po/components/list-row.po';

export default class SortableTablePo extends ComponentPo {
  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  /** Create a name that should, when sorted by name, by default appear first */
  static firstByDefaultName(context = 'resource'): string {
    return `11111-first-in-list-unique-${context}`;
  }

  /** Returns the link for resource details for a table row with a given name */
  detailsPageLinkWithName(name: string, selector = 'td.col-link-detail a'): Locator {
    return this.rowElementWithName(name).locator(selector);
  }

  bulkActionButton(label: string): Locator {
    return this.self().locator('.fixed-header-actions .bulk button').filter({ hasText: label });
  }

  bulkActionDropDown(): Locator {
    return this.self().locator('.fixed-header-actions .bulk .bulk-actions-dropdown');
  }

  async bulkActionDropDownOpen(): Promise<void> {
    await this.bulkActionDropDown().click();
  }

  bulkActionDropDownPopOver(): Locator {
    return this.page.locator('[dropdown-menu-collection]');
  }

  bulkActionDropDownButton(name: string): Locator {
    return this.bulkActionDropDownPopOver().locator('[dropdown-menu-item]').filter({ hasText: name });
  }

  groupByButtons(index: number): Locator {
    return this.self().locator(`[data-testid="button-group-child-${index}"]`);
  }

  deleteButton(): Locator {
    return this.page.getByTestId('sortable-table-promptRemove');
  }

  selectedCountText(): Locator {
    return this.page.locator('.action-availability');
  }

  filterComponent(): Locator {
    return this.self().locator('[data-testid="search-box-filter-row"] input');
  }

  async filter(searchText: string): Promise<void> {
    await this.filterComponent().focus();
    await this.filterComponent().clear();
    await this.filterComponent().fill(searchText);
  }

  async resetFilter(): Promise<void> {
    await this.filterComponent().focus();
    await this.filterComponent().clear();
  }

  groupElementWithName(name: string): Locator {
    return this.self().locator('tr.group-row').filter({ hasText: name });
  }

  rowElements(): Locator {
    return this.self().locator('tbody tr:not(.sub-row):not(.group-row):not(.additional-sub-row)');
  }

  rowElementWithName(name: string): Locator {
    // Find rows by exact name match — supports both linked (td a) and plain text (td) names
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exactRegex = new RegExp(`^\\s*${escaped}\\s*$`);

    return this.self()
      .locator('tbody tr')
      .filter({
        has: this.page.locator('td').filter({ hasText: exactRegex }),
      });
  }

  rowElementWithPartialName(name: string): Locator {
    return this.self().locator('tbody tr').filter({ hasText: name });
  }

  tableHeaderRowElementWithPartialName(name: string): Locator {
    return this.self().locator('thead tr').filter({ hasText: name });
  }

  subRows(): Locator {
    return this.self().locator('tbody tr.sub-row');
  }

  rowElementLink(rowIndex: number, columnIndex: number): Locator {
    return this.getTableCell(rowIndex, columnIndex).locator('a');
  }

  getTableCell(rowIndex: number, columnIndex: number): Locator {
    return this.row(rowIndex).column(columnIndex);
  }

  row(index: number): ListRowPo {
    return new ListRowPo(this.rowElements().nth(index));
  }

  rowWithPartialName(name: string): ListRowPo {
    return new ListRowPo(this.rowElementWithPartialName(name));
  }

  rowWithName(name: string): ListRowPo {
    return new ListRowPo(this.rowElementWithName(name));
  }

  /** Get row names from the table */
  async rowNames(rowNameSelector = 'td:nth-of-type(3)'): Promise<string[]> {
    const cells = this.rowElements().locator(rowNameSelector);
    const count = await cells.count();
    const names: string[] = [];

    for (let i = 0; i < count; i++) {
      names.push(await cells.nth(i).innerText());
    }

    return names;
  }

  rowActionMenu(): ActionMenuPo {
    return new ActionMenuPo(this.page);
  }

  async noRowsShouldNotExist(): Promise<void> {
    await expect(this.noRowsText()).not.toBeAttached();
  }

  noRowsText(): Locator {
    return this.self().locator('tbody .no-rows');
  }

  /** Get the row element count on sortable table */
  async rowCount(): Promise<number> {
    return await this.rowElements().count();
  }

  /** Check row element count on sortable table */
  async checkRowCount(isEmpty: boolean, expected: number): Promise<void> {
    const rows = this.rowElements();

    await expect(rows).toHaveCount(expected);

    if (isEmpty) {
      if (expected === 1) {
        const row = rows.first();
        const text = await row.innerText();

        expect(
          text.includes('There are no rows to show.') ||
            text.includes('There are no rows which match your search query.'),
        ).toBe(true);
      }
    }
  }

  /** For a row with the given name open its action menu and return the drop down */
  async rowActionMenuOpen(name: string, skipNoActionAvailableCheck?: boolean): Promise<ActionMenuPo> {
    const row = this.rowWithName(name);

    await row.actionBtn().click();
    await expect(row.actionBtn()).toHaveAttribute('aria-expanded', 'true');

    const actionMenu = this.rowActionMenu();

    await expect(actionMenu.self()).toBeAttached();

    if (!skipNoActionAvailableCheck) {
      await expect(actionMenu.self()).not.toContainText('No actions available');
      await expect(actionMenu.self().locator('[dropdown-menu-item]:not([disabled])').first()).toBeAttached();
    }

    return actionMenu;
  }

  async rowActionMenuClose(name: string): Promise<ActionMenuPo> {
    const row = this.rowWithName(name);

    await row.actionBtn().click();

    return this.rowActionMenu();
  }

  /** For a row with the given name return the checkbox used to select it */
  rowSelectCtlWithName(clusterName: string): CheckboxInputPo {
    return new CheckboxInputPo(this.page, 'td:first-child', this.rowWithName(clusterName).self());
  }

  rowWithClusterName(clusterName: string): Locator {
    return this.rowWithName(clusterName).column(2);
  }

  selectAllCheckbox(): ComponentPo {
    return new ComponentPo(this.page, '[data-testid="sortable-table_check_select_all"]');
  }

  async selectedCount(): Promise<number> {
    return await this.page.locator('.row-check input[type="checkbox"]:checked').count();
  }

  async checkLoadingIndicatorNotVisible(): Promise<void> {
    await expect(this.page.locator('tbody .data-loading')).not.toBeAttached({ timeout: 10000 });
  }

  async checkNoRowsNotVisible(): Promise<void> {
    await expect(this.page.locator('tbody .no-rows')).not.toBeAttached({ timeout: 10000 });
  }

  async checkVisible(): Promise<void> {
    await expect(this.self()).toBeVisible();
  }

  groupElementsWithName(name: string): Locator {
    return this.self().locator('tr.group-row').filter({ hasText: name });
  }

  tableHeaderRow(): Locator {
    return this.self().locator('thead tr');
  }

  /** Return the visible text of each column header */
  async headerNames(): Promise<string[]> {
    const cells = this.tableHeaderRow().locator('.table-header-container .content');
    const count = await cells.count();
    const names: string[] = [];

    for (let i = 0; i < count; i++) {
      names.push((await cells.nth(i).innerText()).trim());
    }

    return names;
  }

  sort(index: number): Locator {
    return this.self().locator('thead tr').locator('th').nth(index).locator('.sort');
  }

  async deleteItemWithUI(name: string): Promise<void> {
    const actionMenu = await this.rowActionMenuOpen(name);

    await actionMenu.getMenuItem('Delete').click();

    // Click the remove/confirm button on the prompt
    await this.page.locator('[data-testid="prompt-remove-confirm"]').click();
  }

  pagination(): Locator {
    return this.page.locator('div.paging');
  }

  async waitForListItemRemoval(rowNameSelector: string, name: string): Promise<void> {
    const rows = await this.rowNames(rowNameSelector);

    if (rows.includes(name)) {
      await expect(this.self().locator(rowNameSelector).filter({ hasText: name })).not.toBeAttached({ timeout: 30000 });
    }
  }
}
