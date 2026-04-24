import type { Page, Locator } from '@playwright/test';

/**
 * Base component page object for Playwright.
 * Replaces the Cypress ComponentPo pattern.
 *
 * All page objects hold a reference to the Playwright Page and
 * expose a `self()` method returning a Locator — the Playwright
 * equivalent of Cypress Chainable.
 *
 * Per Playwright POM best practice, POs expose Locators for specs
 * to assert with expect(). POs do NOT contain expect() calls.
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
}
