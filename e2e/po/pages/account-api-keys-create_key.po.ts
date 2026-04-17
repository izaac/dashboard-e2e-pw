import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';

export default class CreateKeyPagePo extends PagePo {
  static url = '/account/create-key';

  constructor(page: Page) {
    super(page, CreateKeyPagePo.url);
  }

  async cancel(): Promise<void> {
    await this.self().locator('button.role-secondary').click();
  }
}
