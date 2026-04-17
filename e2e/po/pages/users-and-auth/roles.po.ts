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
        },
      }),
    };
  }

  tabs() {
    return new TabbedPo(this.page, '[data-testid="tabbed-block"]');
  }

  async waitForRequests(): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes('/v1/management.cattle.io.roletemplates') && resp.status() === 200,
    );

    await this.goTo();
    await responsePromise;
  }

  async goToEditYamlPage(elemName: string): Promise<void> {
    const actionMenu = await this.list('GLOBAL').rowWithName(elemName);

    // This is a simplified version - the upstream uses actionMenu('Edit YAML').click()
    // In Playwright context this would use the sortable table row action menu
    const container = this.page.locator(`#GLOBAL [data-testid="sortable-table-list-container"]`);
    const row = container.locator('tr').filter({ hasText: elemName });

    await row.locator('[data-testid*="action-button"]').click();
    await this.page.locator('[dropdown-menu-item]').filter({ hasText: 'Edit YAML' }).click();
  }

  async listCreate(label: string): Promise<void> {
    await this.self().locator('.resource-list-masthead .actions').getByText(label).click();
  }

  checkExists(): void {
    // Implemented in base class
  }
}
