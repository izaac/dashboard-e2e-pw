import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';

export default class NotFoundPagePo extends PagePo {
  constructor(page: Page, path: string) {
    super(page, path);
  }

  errorTitle(): Locator {
    return this.self().locator('.text-center h1');
  }

  errorMessage(): Locator {
    return this.self().locator('.text-center h2');
  }
}
