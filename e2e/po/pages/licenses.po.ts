import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';

export default class LicensesPagePo extends PagePo {
  static url = '/licenses';

  constructor(page: Page) {
    super(page, LicensesPagePo.url);
  }

  sortableTable(): SortableTablePo {
    return new SortableTablePo(this.page, '.sortable-table');
  }

  packageLinks(): Locator {
    return this.page.locator('.package-link');
  }

  /** Empty state row rendered when the filter matches no package */
  noResultsText(): Locator {
    return this.sortableTable().self().locator('tbody .no-results');
  }

  packageLink(name: string): Locator {
    return this.packageLinks().filter({ hasText: name });
  }

  searchInput(): Locator {
    return this.page.locator('input[type="search"], .search-box input').first();
  }

  slideIn(): Locator {
    return this.page.locator('.slide-in');
  }

  slideInContent(): Locator {
    return this.page.getByTestId('slide-in-panel-component');
  }

  /** License id badge, or the empty-state message when no license content exists */
  slideInMetadata(): Locator {
    return this.slideInContent().locator('.license-badge, .empty').first();
  }

  slideInCloseButton(): Locator {
    return this.page.getByTestId('slide-in-close');
  }

  breadcrumbAboutLink(): Locator {
    return this.page.locator('h1 a, .breadcrumb a').filter({ hasText: 'About' });
  }
}
