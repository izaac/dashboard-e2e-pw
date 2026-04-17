import type { Page, Locator } from '@playwright/test';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import type ActionMenuPo from '@/e2e/po/components/action-menu.po';

export default class MgmtFeatureFlagListPo extends BaseResourceList {
  constructor(page: Page, parent?: Locator) {
    super(page, ':scope', parent);
  }

  details(name: string, index: number): Locator {
    return this.resourceTable().sortableTable().rowWithName(name).column(index);
  }

  async clickRowActionMenuItem(name: string, itemLabel: string): Promise<void> {
    const actionMenu: ActionMenuPo = await this.resourceTable().sortableTable().rowActionMenuOpen(name);

    await actionMenu.getMenuItem(itemLabel).click();
  }
}
