import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import ActionMenuPo from '@/e2e/po/components/action-menu.po';
import ListRowPo from '@/e2e/po/components/list-row.po';
import { STANDARD, LONG } from '@/support/timeouts';

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
    // Bulk action buttons live in .sortable-table-header (sibling of .sortable-table)
    return this.self().locator('..').locator('.fixed-header-actions .bulk button').filter({ hasText: label });
  }

  bulkActionDropDown(): Locator {
    return this.self().locator('..').locator('.fixed-header-actions .bulk .bulk-actions-dropdown');
  }

  async bulkActionDropDownOpen(): Promise<void> {
    // v2.15+: dropdown gear is hidden when few bulk actions exist (direct buttons shown instead)
    const dropdown = this.bulkActionDropDown();

    if (await dropdown.isVisible()) {
      await dropdown.click();
    }
  }

  bulkActionDropDownPopOver(): Locator {
    return this.page.locator('[dropdown-menu-collection]');
  }

  bulkActionDropDownButton(name: string): Locator {
    return this.bulkActionDropDownPopOver().locator('[dropdown-menu-item]').filter({ hasText: name });
  }

  groupByButtons(index: number): Locator {
    // Group-by buttons can be inside the sortable-table container or in the header above it
    return this.self()
      .locator(`[data-testid="button-group-child-${index}"]`)
      .or(this.page.locator(`[data-testid="button-group-child-${index}"]`).first());
  }

  deleteButton(): Locator {
    return this.page.getByTestId('sortable-table-promptRemove');
  }

  selectedCountText(): Locator {
    return this.page.locator('.action-availability');
  }

  filterComponent(): Locator {
    // Search input lives in .sortable-table-header, a sibling of the <table>
    return this.self().locator('..').locator('[data-testid="search-box-filter-row"] input').first();
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

  groupRows(): Locator {
    return this.self().locator('tr.group-row');
  }

  groupElementWithName(name: string): Locator {
    return this.groupRows().filter({ hasText: name });
  }

  rowElements(): Locator {
    return this.self().locator('tbody tr:not(.sub-row):not(.group-row):not(.additional-sub-row)');
  }

  rowElementWithName(name: string): Locator {
    // Find rows by exact name match. Works for all cell types:
    //   - linked cells (td a) — hasText matches the inner <a> text
    //   - plain text cells (td with direct text — e.g. feature flags)
    //   - cells with name+description (td span + td div) — matches span/a only, not whole td
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exactRegex = new RegExp(`^\\s*${escaped}\\s*$`);

    return this.self()
      .locator('tbody tr')
      .filter({
        has: this.page
          .locator('td')
          .filter({
            has: this.page.locator('span, a').filter({ hasText: exactRegex }),
          })
          .or(this.page.locator('td').filter({ hasText: exactRegex })),
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

  noRowsText(): Locator {
    return this.self().locator('tbody .no-rows');
  }

  loadingIndicator(): Locator {
    return this.page.locator('tbody .data-loading');
  }

  /** Get the row element count on sortable table */
  async rowCount(): Promise<number> {
    return await this.rowElements().count();
  }

  /** For a row with the given name open its action menu and return the drop down */
  async rowActionMenuOpen(name: string, skipNoActionAvailableCheck?: boolean): Promise<ActionMenuPo> {
    const row = this.rowWithName(name);

    await row.actionBtn().click();

    // v-popper may render the dropdown in a page-level portal rather than inside the row.
    // Wait for the menu to appear at page scope; fall back to row-scoped if not found.
    const pageMenu = new ActionMenuPo(this.page);

    await pageMenu.self().or(new ActionMenuPo(this.page, row.self()).self()).waitFor({ state: 'attached' });

    const menuInRow = (await new ActionMenuPo(this.page, row.self()).self().count()) > 0;
    const actionMenu = menuInRow ? new ActionMenuPo(this.page, row.self()) : pageMenu;

    if (!skipNoActionAvailableCheck) {
      await actionMenu.self().locator('[dropdown-menu-item]:not([disabled])').first().waitFor({ state: 'attached' });
    }

    return actionMenu;
  }

  async rowActionMenuClose(name: string): Promise<void> {
    const row = this.rowWithName(name);
    const pageMenu = new ActionMenuPo(this.page);
    const isPageMenuOpen = (await pageMenu.self().count()) > 0;

    if (isPageMenuOpen) {
      await row.actionBtn().click();
      await pageMenu.self().waitFor({ state: 'detached' });
    } else {
      const rowMenu = new ActionMenuPo(this.page, row.self());

      if ((await rowMenu.self().count()) > 0) {
        await row.actionBtn().click();
        await rowMenu.self().waitFor({ state: 'detached' });
      }
    }
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

  async selectAll(): Promise<void> {
    await this.selectAllCheckbox().self().locator('.checkbox-custom').click();
  }

  async selectedCount(): Promise<number> {
    return await this.page.locator('.row-check input[type="checkbox"]:checked').count();
  }

  async checkLoadingIndicatorNotVisible(): Promise<void> {
    await this.loadingIndicator().waitFor({ state: 'detached', timeout: STANDARD });
  }

  async checkNoRowsNotVisible(): Promise<void> {
    await this.noRowsText().waitFor({ state: 'detached', timeout: STANDARD });
  }

  groupElementsWithName(name: string): Locator {
    return this.self().locator('tr.group-row').filter({ hasText: name });
  }

  groupTab(name: string): Locator {
    return this.self().locator('.group-tab').filter({ hasText: name });
  }

  tableHeaderRow(): Locator {
    return this.self().locator('thead tr');
  }

  /** Return the visible text of each column header */
  async headerNames(): Promise<string[]> {
    const cells = this.headerContentCells();
    const count = await cells.count();
    const names: string[] = [];

    for (let i = 0; i < count; i++) {
      names.push((await cells.nth(i).innerText()).trim());
    }

    return names;
  }

  headerContentCells(): Locator {
    return this.tableHeaderRow().locator('.table-header-container .content');
  }

  sort(index: number): Locator {
    return this.self().locator('thead tr').locator('th').nth(index).locator('.sort');
  }

  /** Find the sort handle for a column by its visible header text (avoids checkbox off-by-one) */
  sortByName(columnName: string): Locator {
    return this.self().locator(`thead tr th:has(.table-header-container .content:text("${columnName}")) .sort`);
  }

  /** Locator for the sort direction icon on a column by header text */
  sortIconByName(columnName: string, direction: 'up' | 'down'): Locator {
    return this.self()
      .locator(`thead tr th:has(.table-header-container .content:text("${columnName}"))`)
      .locator(`.sort .icon-stack > i.icon-sort-${direction}`);
  }

  /** Locator for the sort direction icon on a column by index */
  sortIcon(colIndex: number, direction: 'up' | 'down'): Locator {
    return this.self().locator('thead tr th').nth(colIndex).locator(`.sort .icon-stack > i.icon-sort-${direction}`);
  }

  /**
   * Cells in the Age column. Useful as a mask target in visual snapshot
   * tests — relative time ("3 minutes ago") drifts between runs.
   */
  ageColumn(): Locator {
    return this.self().locator('tbody tr td.col-age');
  }

  /**
   * Wait until the table itself has mounted (header row present), regardless
   * of whether the body has rows or shows the empty state. Use before a
   * visual snapshot — `checkLoadingIndicatorNotVisible` alone passes vacuously
   * while the dashboard shell spinner is still covering the page.
   */
  async waitForReady(): Promise<void> {
    await this.tableHeaderRow().waitFor({ state: 'visible' });
    await this.checkLoadingIndicatorNotVisible();
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

  paginationBeginButton(): Locator {
    return this.pagination().locator('button').nth(0);
  }

  paginationPrevButton(): Locator {
    return this.pagination().locator('button').nth(1);
  }

  paginationNextButton(): Locator {
    return this.pagination().locator('button').nth(2);
  }

  paginationEndButton(): Locator {
    return this.pagination().locator('button').nth(3);
  }

  /** Text like "1 - 10 of 25 Pods" shown between pagination buttons */
  paginationText(): Locator {
    return this.pagination().locator('span');
  }

  /** Returns the cell locator at a given column index (0-based) for a row */
  rowCell(row: Locator, colIndex: number): Locator {
    return row.locator(`td:nth-of-type(${colIndex + 1})`);
  }

  async waitForListItemRemoval(rowNameSelector: string, name: string): Promise<void> {
    const rows = await this.rowNames(rowNameSelector);

    if (rows.includes(name)) {
      await this.self()
        .locator(rowNameSelector)
        .filter({ hasText: name })
        .waitFor({ state: 'detached', timeout: LONG });
    }
  }
}
