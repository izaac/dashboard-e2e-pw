import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Base component page object for Playwright.
 * Replaces the Cypress ComponentPo pattern.
 *
 * All page objects hold a reference to the Playwright Page and
 * expose a `self()` method returning a Locator — the Playwright
 * equivalent of Cypress Chainable.
 */
export default class ComponentPo {
  protected page: Page;
  protected selector: string;
  protected parentLocator?: Locator;

  constructor(page: Page, selector: string, parent?: Locator) {
    this.page = page;
    this.selector = selector;
    this.parentLocator = parent;
  }

  /** Root locator for this component */
  self(): Locator {
    if (this.parentLocator) {
      return this.parentLocator.locator(this.selector);
    }

    return this.page.locator(this.selector);
  }

  /** Get by data-testid within this component */
  testId(id: string): Locator {
    return this.self().getByTestId(id);
  }

  async isDisabled(): Promise<boolean> {
    return this.self().isDisabled();
  }

  async checkVisible(): Promise<void> {
    await this.self().scrollIntoViewIfNeeded();
    await expect(this.self()).toBeVisible();
  }

  async checkNotVisible(): Promise<void> {
    await expect(this.self()).not.toBeVisible();
  }

  async checkExists(): Promise<void> {
    await expect(this.self()).toBeAttached();
  }

  async checkNotExists(): Promise<void> {
    await expect(this.self()).not.toBeAttached();
  }

  async shouldHaveValue(value: string): Promise<void> {
    await expect(this.self()).toHaveValue(value);
  }

  async shouldContainText(text: string): Promise<void> {
    await expect(this.self()).toContainText(text);
  }
}
