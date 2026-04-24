import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import { VERY_LONG } from '@/support/timeouts';

export default class ProductNavPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '.side-nav');
  }

  groups(): Locator {
    return this.self().locator('.accordion.has-children');
  }

  async navToSideMenuGroupByLabel(label: string): Promise<void> {
    await this.page.locator('.side-nav').waitFor({ state: 'visible', timeout: VERY_LONG });
    await this.self().locator('.accordion.has-children').filter({ hasText: label }).click();
  }

  sideMenuEntryByLabel(label: string): Locator {
    return this.self()
      .locator('.child.nav-type a .label')
      .filter({ hasText: new RegExp(`^${label}$`) });
  }

  async navToSideMenuEntryByLabel(label: string): Promise<void> {
    await this.sideMenuEntryByLabel(label).waitFor({ state: 'visible', timeout: VERY_LONG });

    const link = this.self()
      .locator('.child.nav-type a')
      .filter({ has: this.page.locator('.label', { hasText: new RegExp(`^${label}$`) }) });

    // On slow servers, first click can miss during accordion animation — retry if URL unchanged
    const urlBefore = this.page.url();

    await link.click();

    try {
      await this.page.waitForURL((url) => url.href !== urlBefore, { timeout: 3000 });
    } catch {
      await link.click();
    }
  }
}
