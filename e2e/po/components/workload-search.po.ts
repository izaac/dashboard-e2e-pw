import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

/**
 * Search box on the Workloads Overview page (workload-dashboard) and its result dropdown.
 */
export default class WorkloadSearchPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '[data-testid="workload-dashboard-search"]');
  }

  input(): Locator {
    return this.self().locator('input.vs__search');
  }

  dropdown(): Locator {
    return this.page.locator('.vs__dropdown-menu');
  }

  options(): Locator {
    return this.dropdown().locator('.workload-search-option');
  }

  kebab(index: number): Locator {
    return this.options().nth(index).locator('.actions button');
  }

  /** Any open row action menu on the page */
  actionMenus(): Locator {
    return this.page.locator('.list-unstyled.menu, [role="menu"]');
  }

  async search(term: string): Promise<void> {
    await this.input().click();
    await this.input().fill(term);
  }
}
