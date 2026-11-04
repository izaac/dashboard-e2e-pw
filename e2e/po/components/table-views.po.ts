import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

/**
 * Page object for the Table Views feature (saved views tabs, search query,
 * tab menu actions and the publish modal).
 *
 * Locators are page-scoped because the menu, rename input and publish modal
 * may be teleported outside of the controls root.
 */
export default class TableViewsPo extends ComponentPo {
  constructor(page: Page, selector = '[data-testid="table-views-controls"]', parent?: Locator) {
    super(page, selector, parent);
  }

  tabsContainer(): Locator {
    return this.page.locator('[data-testid="table-views-tabs"]');
  }

  tabs(): Locator {
    return this.tabsContainer().getByRole('tab');
  }

  tab(nameOrId: string): Locator {
    return this.page.locator(`[data-testid="table-views-tab-${nameOrId}"]`);
  }

  allTab(): Locator {
    return this.page.locator('[data-testid="table-views-tab-all"]');
  }

  activeTab(): Locator {
    return this.tabsContainer().locator('[role="tab"].active, [role="tab"][aria-selected="true"]');
  }

  unsavedDot(): Locator {
    return this.page.locator('[data-testid="table-views-unsaved"]');
  }

  searchInput(): Locator {
    return this.page.locator('[data-testid="table-views-query"]');
  }

  searchClearButton(): Locator {
    return this.page.locator('[data-testid="table-views-query-clear"]');
  }

  tabMenuButton(id = 'all'): Locator {
    return this.page.locator(`[data-testid="table-views-tab-menu-${id}"]`);
  }

  newTabButton(): Locator {
    return this.page.locator('[data-testid="table-views-new-tab"]');
  }

  menuSaveAsNew(): Locator {
    return this.page.locator('[data-testid="table-views-save-as-new"]');
  }

  menuSaveChanges(): Locator {
    return this.page.locator('[data-testid="table-views-save-changes"]');
  }

  menuDiscardChanges(): Locator {
    return this.page.locator('[data-testid="table-views-discard"]');
  }

  menuPublish(id = 'all'): Locator {
    return this.page.locator(`[data-testid="table-views-publish-${id}"]`);
  }

  renameInput(): Locator {
    return this.page.locator('input[data-testid^="table-views-rename-input-"], input[aria-label="Rename View"]');
  }

  publishModal(): Locator {
    return this.page.locator('[data-testid="table-views-publish-modal"]');
  }

  publishWarning(): Locator {
    return this.page.locator('[data-testid="table-views-publish-warning"]');
  }

  publishConfirmButton(): Locator {
    return this.page.locator('[data-testid="table-views-publish-confirm"]');
  }

  publishCancelButton(): Locator {
    return this.publishModal().getByRole('button', { name: 'Cancel' });
  }

  modalBackdrop(): Locator {
    return this.page.locator('.rc-modal-backdrop, .v-modal');
  }
}
