import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class SelectIconGridPo extends ComponentPo {
  private componentId: string;

  constructor(page: Page, selector: string, componentId = 'select-icon-grid', parent?: Locator) {
    super(page, selector, parent);
    this.componentId = componentId;
  }

  async select(name: string): Promise<void> {
    await this.self().locator('.name').getByText(name, { exact: true }).click();
  }

  getGridEntry(idx: number, componentTestId = this.componentId): Locator {
    return this.self().getByTestId(`${componentTestId}-${idx}`);
  }
}
