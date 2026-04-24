import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';

/**
 * Get Support page
 */
export default class SupportPagePo extends PagePo {
  static url = '/support';

  constructor(page: Page) {
    super(page, SupportPagePo.url);
  }

  /** Get all support links in the simple-box containers */
  supportLinks(): Locator {
    return this.page.locator('.simple-box .support-link > a');
  }

  /** Get external support links */
  externalSupportLink(index: number): Locator {
    return this.page.locator('.external .support-link > a').nth(index);
  }

  externalSupportLinks(index: number): Locator {
    return this.page.locator('.external .support-link > a').nth(index);
  }

  /** Get the SCC link */
  sccLink(): Locator {
    return this.page.locator('a[href="https://scc.suse.com"]');
  }

  async clickSupportLink(index: number, isNewTab?: boolean): Promise<void> {
    const link = this.supportLinks().nth(index);

    if (isNewTab) {
      await link.filter({ has: this.page.locator('[target]') }).waitFor();
      await link.evaluate((el) => el.removeAttribute('target'));
      await link.click();
    } else {
      await link.click();
    }
  }

  async clickExternalSupportLinks(index: number): Promise<void> {
    const link = this.externalSupportLinks(index);

    await link.filter({ has: this.page.locator('[target]') }).waitFor();
    await link.evaluate((el) => el.removeAttribute('target'));
    await link.click();
  }

  async clickSccLink(): Promise<void> {
    const link = this.sccLink();

    await link.filter({ has: this.page.locator('[target]') }).waitFor();
    await link.evaluate((el) => el.removeAttribute('target'));
    await link.click();
  }
}
