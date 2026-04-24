import type { Page, Locator } from '@playwright/test';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';

export default class RoleListPo extends BaseResourceList {
  constructor(page: Page, selector: string) {
    super(page, selector);
  }

  downloadYaml(): Locator {
    return this.self().getByTestId('sortable-table-download');
  }

  async rowCloneYamlClick(name: string): Promise<void> {
    const actionMenu = await this.resourceTable().sortableTable().rowActionMenuOpen(name);

    await actionMenu.getMenuItem('Clone').click();
  }

  delete(): Locator {
    return this.resourceTable().sortableTable().deleteButton().first();
  }

  elements(): Locator {
    return this.resourceTable().sortableTable().rowElements();
  }

  elementWithName(name: string): Locator {
    return this.resourceTable().sortableTable().rowElementWithName(name);
  }

  details(name: string, index: number): Locator {
    return this.resourceTable().sortableTable().rowWithName(name).column(index);
  }

  /** Click the detail link in a specific column for a role */
  detailLink(name: string, columnIndex: number): Locator {
    return this.details(name, columnIndex).locator('a');
  }

  /** Get the built-in indicator for a role */
  builtInIndicator(name: string): Locator {
    return this.details(name, 4).locator('span i.icon-checkmark');
  }

  /** Get the default indicator for a role */
  defaultIndicator(name: string): Locator {
    return this.details(name, 5).locator('span i.icon-checkmark');
  }
}
