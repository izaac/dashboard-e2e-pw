import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';

export default class AboutPagePo extends PagePo {
  static url = '/about';

  constructor(page: Page) {
    super(page, AboutPagePo.url);
  }

  diagnosticsBtn(): Locator {
    return this.page.getByTestId('about__diagnostics_button');
  }
}
