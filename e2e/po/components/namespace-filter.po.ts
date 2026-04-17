import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export class NamespaceFilterPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '[data-testid="namespaces-filter"]');
  }

  async toggle(): Promise<void> {
    await this.namespaceDropdown().click({ force: true });
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

  /** Check if an option is checked by label */
  async isChecked(label: string): Promise<void> {
    const option = this.getOptions().getByText(new RegExp(` ${label} `));

    await expect(option.locator('i')).toHaveClass(/icon-checkmark/);
  }

  /** Get checkmark icon */
  checkIcon(): Locator {
    return this.self().locator('.icon-checkmark');
  }

  /** Verify "All" is selected (no specific namespace filter) */
  async allSelected(): Promise<void> {
    await expect(this.self().getByTestId('namespaces-values-none')).toBeAttached();
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
