import type { Page, Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';
import ComponentPo from '@/e2e/po/components/component.po';

/**
 * Accessibility helper component.
 * Wraps axe-core scans and the locators needed to wait for a page to be ready before scanning.
 */
export default class AccessibilityPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '.dashboard-root');
  }

  /** Main content region of the dashboard, used as a readiness signal before scanning */
  mainContent(): Locator {
    return this.self();
  }

  /** Global search input in the header */
  searchInput(): Locator {
    return this.page.getByTestId('header-search');
  }

  /** Force the UI theme via the R_THEME cookie (must be set before navigating) */
  async themeCookie(theme: 'light' | 'dark', baseUrl: string): Promise<void> {
    await this.page.context().addCookies([{ name: 'R_THEME', value: theme, url: baseUrl }]);
  }

  /**
   * Run the axe `color-contrast` rule and return its violations.
   * @param includeSelector optional CSS selector restricting the scan scope
   */
  async scanColorContrast(includeSelector?: string): Promise<Result[]> {
    let builder = new AxeBuilder({ page: this.page }).withRules(['color-contrast']);

    if (includeSelector) {
      builder = builder.include(includeSelector);
    }

    const results = await builder.analyze();

    return results.violations;
  }
}
