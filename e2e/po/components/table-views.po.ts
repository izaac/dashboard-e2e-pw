import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import { HeaderPo } from '@/e2e/po/components/header.po';

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
    return this.page.getByTestId('table-views-query');
  }

  /** The query box is a contenteditable div, not an input: click it, then type key by key */
  async typeQuery(text: string): Promise<void> {
    await this.searchInput().click();
    await this.searchInput().pressSequentially(text);
  }

  /** Moves focus out of the query box by clicking an inert corner of the top header */
  async blurQuery(): Promise<void> {
    await new HeaderPo(this.page).clickInertCorner();
  }

  searchClearButton(): Locator {
    return this.page.getByTestId('table-views-query-clear');
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

  viewMenuButton(): Locator {
    return this.page.locator('[data-testid="table-views-view-menu"]');
  }

  viewColumnsItem(): Locator {
    return this.page.locator('[data-testid="table-views-view-columns"]');
  }

  columnItem(key: string): Locator {
    return this.page.locator(`[data-testid="table-views-col-${key}"]`);
  }

  columnHandle(key: string): Locator {
    return this.page.locator(`[data-testid="table-views-col-handle-${key}"]`);
  }

  selectAllColumnsButton(): Locator {
    return this.page.locator('[data-testid="table-views-columns-select-all"]');
  }

  resetColumnsButton(): Locator {
    return this.page.locator('[data-testid="table-views-columns-reset"]');
  }

  modalBackdrop(): Locator {
    return this.page.locator('.rc-modal-backdrop, .v-modal');
  }

  /** The open dropdown panel (tab menu or View menu), which is teleported out of the controls root */
  menu(): Locator {
    return this.page.locator('[dropdown-menu-collection]');
  }

  /** The "You have unsaved changes..." notice at the top of a dirty tab's menu */
  tabMenuNotice(): Locator {
    return this.menu().locator('.menu-notice');
  }

  menuDuplicate(id = 'all'): Locator {
    return this.page.locator(`[data-testid="table-views-duplicate-${id}"]`);
  }

  /** Not offered on the All tab, which has nothing saved to go back to */
  menuResetToDefault(id: string): Locator {
    return this.page.locator(`[data-testid="table-views-reset-${id}"]`);
  }

  menuExportAll(id = 'all'): Locator {
    return this.page.locator(`[data-testid="table-views-export-${id}"]`);
  }

  menuSetDefault(id = 'all'): Locator {
    return this.page.locator(`[data-testid="table-views-set-default-${id}"]`);
  }

  menuShareView(id = 'all'): Locator {
    return this.page.locator(`[data-testid="table-views-share-${id}"]`);
  }

  menuImportView(id = 'all'): Locator {
    return this.page.locator(`[data-testid="table-views-import-${id}"]`);
  }

  menuDelete(id: string): Locator {
    return this.page.locator(`[data-testid="table-views-delete-${id}"]`);
  }

  /** The Undo link on the "View Deleted" toast */
  undoDeleteButton(): Locator {
    return this.page.locator('.growl-list').getByRole('button', { name: 'Undo' });
  }

  shareModal(): Locator {
    return this.page.locator('[data-testid="table-views-share-modal"]');
  }

  shareWarning(): Locator {
    return this.page.locator('[data-testid="table-views-share-warning"]');
  }

  shareText(): Locator {
    return this.page.locator('[data-testid="table-views-share-text"]');
  }

  shareCloseButton(): Locator {
    return this.page.locator('[data-testid="table-views-share-close"]');
  }

  importModal(): Locator {
    return this.page.locator('[data-testid="table-views-import-modal"]');
  }

  importInput(): Locator {
    return this.page.locator('[data-testid="table-views-import-text"]').locator('textarea, input');
  }

  importProblem(): Locator {
    return this.page.locator('[data-testid="table-views-import-problem"]');
  }

  importConfirmButton(): Locator {
    return this.page.locator('[data-testid="table-views-import-confirm"]');
  }

  /** The View menu's Group By entry, which opens the grouping submenu */
  viewGroupItem(): Locator {
    return this.page.locator('[data-testid="table-views-view-group"]');
  }

  groupOption(id: string): Locator {
    return this.page.locator(`[data-testid="table-views-group-${id}"]`);
  }

  /** The "Reset to Default" of the View menu itself, which resets the whole view */
  viewResetButton(): Locator {
    return this.page.locator('[data-testid="table-views-reset"]');
  }

  /** The screen reader status line under the toolbar, which also carries the "Grouping reset to ..." wording */
  announcement(): Locator {
    return this.page.locator('[data-testid="table-views-announcement"]');
  }

  /** The filter problem line shown under the query box */
  queryProblem(): Locator {
    return this.page.locator('[data-testid="table-views-query-problem"]');
  }

  suggestions(): Locator {
    return this.page.locator('[data-testid="table-views-suggestions"]');
  }

  suggestionsLoading(): Locator {
    return this.page.locator('[data-testid="table-views-suggestions-loading"]');
  }

  suggestionOptions(): Locator {
    return this.suggestions().getByRole('option');
  }

  exportModal(): Locator {
    return this.page.locator('[data-testid="table-views-export-modal"]');
  }

  exportFormat(format: string): Locator {
    return this.exportModal().getByRole('radio', { name: format });
  }

  exportDownloadButton(): Locator {
    return this.page.locator('[data-testid="table-views-export-download"]');
  }

  /** The "N Selected" button that opens the actions of the ticked rows */
  selectionActionsButton(): Locator {
    return this.page.getByRole('button', { name: /\d+ Selected/ });
  }

  selectionExportAction(): Locator {
    return this.page.getByRole('menuitem', { name: 'Export As...' });
  }

  /**
   * Holds back every request for the values of a filter field (the `summary` requests) until the
   * returned function is called, so the "Loading values..." state can be looked at for as long as needed.
   */
  async holdSuggestionRequests(): Promise<() => void> {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    await this.page.route(/[?&]summary=/, async (route) => {
      await gate;
      await route.fallback();
    });

    return release;
  }
}
