import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class ResourceListMastheadPo extends ComponentPo {
  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  actions(): Locator {
    return this.page.locator('.actions-container .actions .btn, [data-testid="masthead-action-menu"]');
  }

  title(): Locator {
    return this.page.locator('.title h1, .primaryheader h1, .title-bar h1.title');
  }

  async createYaml(): Promise<void> {
    await this.self().getByTestId('masthead-create-yaml').click();
  }

  createButton(): Locator {
    return this.self().getByTestId('masthead-create');
  }

  async create(): Promise<void> {
    await this.self().getByTestId('masthead-create').click();
  }
}
