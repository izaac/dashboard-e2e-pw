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

  /** Group header rows (one per resource type with results) */
  groupLabels(): Locator {
    return this.dropdown().locator('.group-label');
  }

  /** Links in the dropdown: the "+ X more" rows and the per-result namespace links */
  moreLinks(): Locator {
    return this.dropdown().locator('.more-link');
  }

  /** Placeholder shown in place of results (min characters, no match, searching, start typing) */
  noOptions(): Locator {
    return this.page.locator('.vs__no-options');
  }

  /** Per-type "failed to fetch" rows */
  errorLabels(): Locator {
    return this.dropdown().locator('.error-label');
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
