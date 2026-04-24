import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BannersPo from '@/e2e/po/components/banners.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import NotificationsCenterPo from '@/e2e/po/components/notification-center.po';

export default class HomePagePo extends PagePo {
  static url = '/home';

  constructor(page: Page) {
    super(page, HomePagePo.url);
  }

  async goTo(): Promise<void> {
    await super.goTo();
  }

  /** Navigate to home page via burger menu */
  async navTo(): Promise<void> {
    const burgerMenu = new BurgerMenuPo(this.page);

    await burgerMenu.toggle();
    await burgerMenu.home().click();
  }

  title(): Locator {
    return this.page.getByTestId('banner-title');
  }

  /** Get the "What's New" banner link */
  whatsNewBannerLink(): Locator {
    return this.changelog().self().locator('a');
  }

  list(): Locator {
    return this.page.locator('[data-testid="sortable-table-list-container"]');
  }

  filterInput(): Locator {
    return this.list().locator('[data-testid="search-box-filter-row"] input');
  }

  clusterDescriptions(): Locator {
    return this.list().locator('.cluster-description');
  }

  tableHeaders(): Locator {
    return this.list().locator('.table-header-container .content');
  }

  manageClustersButton(): Locator {
    return this.page.getByTestId('home-manage-clusters-button');
  }

  /** Get a cluster row by name */
  clusterRow(name: string): Locator {
    return this.list().locator('tr').filter({ hasText: name });
  }

  noResultsMessage(): Locator {
    return this.list().locator('.no-results');
  }

  /** Get a cell from a cluster row (0-indexed) */
  clusterRowCell(name: string, index: number): Locator {
    return this.clusterRow(name).locator('td').nth(index);
  }

  manageButton(): Locator {
    return this.page.getByTestId('cluster-management-manage-button');
  }

  importExistingButton(): Locator {
    return this.page.getByTestId('cluster-create-import-button');
  }

  createButton(): Locator {
    return this.page.getByTestId('cluster-create-button');
  }

  /** Get support links */
  supportLinks(): Locator {
    return this.page.locator('.simple-box .support-link > a');
  }

  /** Get the banner graphic element */
  bannerGraphic(): Locator {
    return this.page.getByTestId('home-banner-graphic');
  }

  /** Get the changelog banner as a BannersPo */
  changelog(): BannersPo {
    return new BannersPo(this.page, '[data-testid="changelog-banner"]');
  }

  /** Get the changelog banner element directly */
  changelogElement(): Locator {
    return this.page.getByTestId('changelog-banner');
  }

  /** Get the home page brand banner image */
  getBrandBannerImage(): Locator {
    return this.page.getByTestId('banner-brand__img');
  }

  /** Get the notifications center */
  notificationsCenter(): NotificationsCenterPo {
    return new NotificationsCenterPo(this.page);
  }

  /** Click a support link by index */
  async clickSupportLink(index: number, isNewTab?: boolean): Promise<void> {
    const link = this.supportLinks().nth(index);

    if (isNewTab) {
      await link.filter({ has: this.page.locator('[target]') }).waitFor();
      // Remove target attribute so we stay in the same tab (Playwright limitation like Cypress)
      await link.evaluate((el) => el.removeAttribute('target'));
      await link.click();
    } else {
      await link.click();
    }
  }

  async toggleBanner(): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes('v1/userpreferences/') && resp.request().method() === 'PUT',
    );

    await this.pageActionsButton().click();
    await this.page.locator('[data-testid="page-actions-banner-link"]').click();
    await responsePromise;
  }

  /** Page actions menu button */
  pageActionsButton(): Locator {
    return this.page.getByTestId('page-actions-menu-action-button');
  }

  /** Menu item within the page actions dropdown */
  pageActionsMenuItem(name: string): Locator {
    return this.page.getByRole('menuitem', { name });
  }

  /** Get the support link at the given index */
  supportLink(index: number): Locator {
    return this.supportLinks().nth(index);
  }

  /** Stub window.open so clicks don't open new tabs; captured calls retrievable via getCapturedOpenCalls() */
  async stubWindowOpen(): Promise<void> {
    await this.page.evaluate(() => {
      (window as any).__openCalls = [];
      window.open = (...args: any[]) => {
        (window as any).__openCalls.push(args);

        return null;
      };
    });
  }

  /** Retrieve the captured window.open calls after stubWindowOpen() */
  async getCapturedOpenCalls(): Promise<any[][]> {
    return this.page.evaluate(() => (window as any).__openCalls);
  }
}
