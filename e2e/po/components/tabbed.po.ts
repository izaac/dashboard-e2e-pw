import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class TabbedPo extends ComponentPo {
  constructor(page: Page, selector = '.dashboard-root', parent?: Locator) {
    super(page, selector, parent);
  }

  async clickNthTab(optionIndex: number): Promise<void> {
    await this.self().locator(`li:nth-child(${optionIndex}) a`).click();
  }

  async clickTabWithSelector(selector: string): Promise<void> {
    await this.self().locator(selector).click();
  }

  async clickTabWithName(name: string): Promise<void> {
    await this.page.getByTestId(`btn-${name}`).click();
  }

  allTabs(componentTestId = 'tabbed'): Locator {
    return this.page.getByTestId(`${componentTestId}-block`).locator('> li');
  }

  getTab(name: string): Locator {
    return this.page.getByTestId(name);
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

  /** Click the add-tab button */
  async addTab(): Promise<void> {
    await this.self().getByTestId('tab-list-add').click();
  }
}
