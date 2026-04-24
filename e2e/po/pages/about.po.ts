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

  /** Get links within the about section by exact text match */
  links(value: string): Locator {
    return this.page.locator('.about a').getByText(value, { exact: true });
  }

  /** Get links within the about section by partial text match */
  linksContaining(value: string): Locator {
    return this.page.locator('.about a').filter({ hasText: value });
  }

  /** Get the href of a link by partial text (for CLI download links) */
  async getLinkDestination(value: string): Promise<string> {
    return (await this.linksContaining(value).first().getAttribute('href')) ?? '';
  }

  /** Get a version link element (for href checking — exact text match) */
  versionLink(value: string): Locator {
    return this.links(value);
  }

  /** Get CLI download link by label (partial match) */
  getCliDownloadLinkByLabel(label: string): Locator {
    return this.page.locator('.about').getByText(label);
  }

  /** Get element displaying the given version string */
  versionText(version: string): Locator {
    return this.page.getByText(version);
  }

  /** Get the Rancher Prime info panel */
  rancherPrimeInfo(): Locator {
    return this.page.getByTestId('rancher-prime-about-panel');
  }

  /** Set the download attribute on a CLI download link so clicking triggers a download instead of navigation */
  async setDownloadAttribute(label: string): Promise<void> {
    await this.getCliDownloadLinkByLabel(label).evaluate((el) => el.setAttribute('download', ''));
  }

  async clickVersionLink(value: string): Promise<void> {
    const link = this.links(value);

    await link.filter({ has: this.page.locator('[target]') }).waitFor();
    await link.evaluate((el) => el.removeAttribute('target'));
    await link.click();
  }
}
