import type { Page, Locator } from '@playwright/test';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';

export default class ClusterRecentEventsListPo extends BaseResourceList {
  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  details(name: string, index: number): Locator {
    return this.resourceTable().sortableTable().rowWithPartialName(name).column(index);
  }

  /** Get the empty state row locator */
  emptyStateRow(): Locator {
    return this.resourceTable().sortableTable().rowWithPartialName('There are no rows to show.').self();
  }
}
