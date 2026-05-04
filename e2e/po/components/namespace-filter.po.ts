import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export class NamespaceFilterPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '[data-testid="namespaces-filter"]');
  }

  /** Toggle the dropdown by clicking the chevron. Has open/closed branching, so kept as orchestration. */
  async toggle(): Promise<void> {
    // Click the chevron icon to avoid hitting selected value tags
    const isOpen = await this.getOptions().isVisible();
    const chevronClass = isOpen ? '.icon-chevron-up' : '.icon-chevron-down';

    await this.namespaceDropdown().locator(chevronClass).click();

    if (!isOpen) {
      await this.getOptions().first().waitFor({ state: 'visible' });
    }
  }

  getOptions(): Locator {
    return this.page.locator('.ns-options');
  }

  /** Locator for an option whose text contains the given label (regex `\bLABEL\b`). */
  optionByLabel(label: string): Locator {
    return this.getOptions().getByText(new RegExp(` ${label} `));
  }

  /** Clear the search input and re-fill it with `label` (orchestration). */
  async searchByName(label: string): Promise<void> {
    await this.self().locator('.ns-controls > .ns-input > .ns-filter-input').clear();
    await this.self().locator('.ns-controls > .ns-input > .ns-filter-input').fill(label);
  }

  /** Locator for the search-input clear button. */
  clearSearchButton(): Locator {
    return this.self().locator('.ns-filter-clear');
  }

  /** Locator for the "clear all selected namespaces" button. */
  clearSelectionButton(): Locator {
    return this.self().locator('.ns-controls > .ns-clear');
  }

  selectedValues(): Locator {
    return this.namespaceDropdown().getByTestId('namespaces-values');
  }

  selectedValueChips(): Locator {
    return this.selectedValues().locator('.ns-value');
  }

  clearIcon(): Locator {
    return this.selectedValues().locator('[data-testid^="namespaces-values-close"]').first();
  }

  namespaceOptions(): Locator {
    return this.getOptions().locator('.ns-option');
  }

  optionByText(text: string): Locator {
    return this.getOptions().locator(`text=${text}`);
  }

  optionById(id: string): Locator {
    return this.getOptions().locator(`#${id}`);
  }

  /** Locator for the checkmark on a selected filter option */
  optionCheckmark(label: string): Locator {
    return this.optionByLabel(label).locator('i.icon-checkmark');
  }

  /** Locator for all checkmarks in the options dropdown (use with toHaveCount) */
  allCheckmarks(): Locator {
    return this.getOptions().locator('i.icon-checkmark');
  }

  /** Locator for the "all namespaces" no-filter indicator */
  noFilterIndicator(): Locator {
    return this.self().getByTestId('namespaces-values-none');
  }

  /** Get the "more" badge when multiple namespaces are selected */
  moreOptionsSelected(): Locator {
    return this.namespaceDropdown().locator('.ns-more');
  }

  /** Locator for the chevron-up that closes the dropdown when it's open. */
  closeChevron(): Locator {
    return this.namespaceDropdown().locator('.icon-chevron-up');
  }

  /** Click an option by label and await the user-preferences PUT (orchestration). */
  async clickOptionByLabelAndWaitForRequest(label: string): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes('v1/userpreferences/') && resp.request().method() === 'PUT',
    );

    await this.optionByLabel(label).click();
    await responsePromise;
  }

  namespaceDropdown(): Locator {
    return this.page.getByTestId('namespaces-dropdown');
  }
}
