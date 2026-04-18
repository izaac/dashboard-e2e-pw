import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import ResourceTablePo from '@/e2e/po/components/resource-table.po';
import ResourceListMastheadPo from '@/e2e/po/components/resource-list-masthead.po';
import ActionMenuPo from '@/e2e/po/components/action-menu.po';
import ListRowPo from '@/e2e/po/components/list-row.po';

export default class BaseResourceList extends ComponentPo {
  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  masthead(): ResourceListMastheadPo {
    return new ResourceListMastheadPo(this.page, ':scope', this.self());
  }

  resourceTable(): ResourceTablePo {
    return new ResourceTablePo(this.page, ':scope', this.self());
  }

  async actionMenu(rowLabel: string): Promise<ActionMenuPo> {
    return this.resourceTable().sortableTable().rowActionMenuOpen(rowLabel);
  }

  rowWithName(rowLabel: string): ListRowPo {
    return this.resourceTable().sortableTable().rowWithName(rowLabel);
  }

  /** Get the state (badge) column for a row by name (column index 1) */
  state(repoName: string): Locator {
    return this.resourceTable().sortableTable().rowWithName(repoName).column(1);
  }

  async actionMenuClose(rowLabel: string): Promise<void> {
    await this.resourceTable().sortableTable().rowActionMenuClose(rowLabel);
  }

  details(name: string, index: number): Locator {
    return this.resourceTable().sortableTable().rowWithName(name).column(index);
  }

  activate(): Locator {
    return this.page.getByTestId('sortable-table-activate');
  }

  deactivate(): Locator {
    return this.page.getByTestId('sortable-table-deactivate');
  }

  async openBulkActionDropdown(): Promise<void> {
    await this.resourceTable().sortableTable().bulkActionDropDownOpen();
  }

  bulkActionButton(name: string): Locator {
    return this.resourceTable().sortableTable().bulkActionDropDownButton(name);
  }
}
