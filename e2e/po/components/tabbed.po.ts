import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class TabbedPo extends ComponentPo {
  constructor(page: Page, selector = '.dashboard-root', parent?: Locator) {
    super(page, selector, parent);
  }

  /** Tab Locator by 1-based DOM index (`li:nth-child(N) a`). */
  tabByIndex(index: number): Locator {
    return this.self().locator(`li:nth-child(${index}) a`);
  }

  /** Tab Locator by CSS selector (relative to the tabbed container). */
  tabBySelector(selector: string): Locator {
    return this.self().locator(selector);
  }

  /** Tab Locator by short name — resolves to `data-testid="btn-${name}"`. */
  tab(name: string): Locator {
    return this.page.getByTestId(`btn-${name}`);
  }

  /** Tab Locator by raw `data-testid` value (no `btn-` prefix). */
  tabByTestId(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  allTabs(componentTestId = 'tabbed'): Locator {
    return this.page.getByTestId(`${componentTestId}-block`).locator('> li');
  }

  /** Get tab label text values */
  async tabNames(tabLabelsSelector = 'a > span'): Promise<string[]> {
    const labels = this.allTabs().locator(tabLabelsSelector);
    const count = await labels.count();
    const names: string[] = [];

    for (let i = 0; i < count; i++) {
      names.push(await labels.nth(i).innerText());
    }

    return names;
  }

  /** Add-tab button Locator. */
  addTabButton(): Locator {
    return this.self().getByTestId('tab-list-add');
  }
}
