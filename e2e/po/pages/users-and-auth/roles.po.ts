import type { Page, Locator } from '@playwright/test';
import ClusterPagePo from '@/e2e/po/pages/cluster-page.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';

/**
 * Page object for Users & Authentication > Role Templates page.
 */
export default class RolesPo extends ClusterPagePo {
  constructor(page: Page, clusterId = '_') {
    super(page, clusterId, 'auth/roles');
  }

  /** Get the resource list container for a given tab */
  list(tabIdSelector: 'GLOBAL' | 'CLUSTER' | 'NAMESPACE') {
    const container = this.page.locator(`#${tabIdSelector} [data-testid="sortable-table-list-container"]`);

    return {
      rowWithName: (name: string) => ({
        async checkExists() {
          const { expect } = await import('@playwright/test');
          const row = container.locator('tr').filter({ hasText: name });

          await expect(row).toBeAttached();
        }
      })
    };
  }

  tabs() {
    return new TabbedPo(this.page, '[data-testid="tabbed-block"]');
  }
}
