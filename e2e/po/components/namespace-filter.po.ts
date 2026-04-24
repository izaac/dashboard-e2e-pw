import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export class NamespaceFilterPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '[data-testid="namespaces-filter"]');
  }

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

  async clickOptionByLabel(label: string): Promise<void> {
    await this.getOptions()
      .getByText(new RegExp(` ${label} `))
      .click();
  }

  async searchByName(label: string): Promise<void> {
    await this.self().locator('.ns-controls > .ns-input > .ns-filter-input').clear();
    await this.self().locator('.ns-controls > .ns-input > .ns-filter-input').fill(label);
  }

  async clearSearchFilter(): Promise<void> {
    await this.self().locator('.ns-filter-clear').click();
  }

  async clearSelectionButton(): Promise<void> {
    await this.self().locator('.ns-controls > .ns-clear').click();
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
    const option = this.getOptions().getByText(new RegExp(` ${label} `));

    return option.locator('i.icon-checkmark');
  }

  /** Locator for the "all namespaces" no-filter indicator */
  noFilterIndicator(): Locator {
    return this.self().getByTestId('namespaces-values-none');
  }

  /** Get the "more" badge when multiple namespaces are selected */
  moreOptionsSelected(): Locator {
    return this.namespaceDropdown().locator('.ns-more');
  }

  async closeDropdown(): Promise<void> {
    await this.namespaceDropdown().locator('.icon-chevron-up').click();
  }

  async clickOptionByLabelAndWaitForRequest(label: string): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes('v1/userpreferences/') && resp.request().method() === 'PUT',
    );

    await this.clickOptionByLabel(label);
    await responsePromise;
  }

  namespaceDropdown(): Locator {
    return this.page.getByTestId('namespaces-dropdown');
  }
}
