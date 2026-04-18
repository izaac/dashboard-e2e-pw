import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
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

  async checkBuiltIn(name: string, isBuiltIn = true): Promise<void> {
    const element = this.details(name, 4).locator('span i.icon-checkmark');

    if (isBuiltIn) {
      await expect(element).toBeAttached();
    } else {
      await expect(element).not.toBeAttached();
    }
  }

  async checkDefault(name: string, isDefault = true): Promise<void> {
    const element = this.details(name, 5).locator('span i.icon-checkmark');

    if (isDefault) {
      await expect(element).toBeAttached();
    } else {
      await expect(element).not.toBeAttached();
    }
  }
}
