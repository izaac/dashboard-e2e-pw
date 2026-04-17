import type { Page, Locator } from '@playwright/test';
import ClusterPagePo from '@/e2e/po/pages/cluster-page.po';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import ComponentPo from '@/e2e/po/components/component.po';
import MgmtUserEditPo from '@/e2e/po/edit/management.cattle.io.user.po';

/**
 * Detail page object for a single user resource.
 */
class MgmtUserResourceDetailPo extends PagePo {
  constructor(page: Page, clusterId: string, userId: string) {
    super(page, `/c/${clusterId}/auth/management.cattle.io.user/${userId}`);
  }
}

/**
 * Page object for Users & Authentication > Users page.
 */
export default class UsersPo extends ClusterPagePo {
  private clusterId: string;

  constructor(page: Page, clusterId = '_') {
    super(page, clusterId, 'auth/management.cattle.io.user');
    this.clusterId = clusterId;
  }

  async waitForRequests(): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes('/v1/management.cattle.io.users') && resp.status() === 200,
      { timeout: 15000 },
    );

    await this.goTo();
    await responsePromise;
  }

  list(): UsersListPo {
    return new UsersListPo(this.page);
  }

  createEdit(userId?: string): MgmtUserEditPo {
    return new MgmtUserEditPo(this.page, this.clusterId, userId);
  }

  detail(userId: string): MgmtUserResourceDetailPo {
    return new MgmtUserResourceDetailPo(this.page, this.clusterId, userId);
  }

  userRetentionLink(): Locator {
    return this.self().locator('[data-testid="router-link-user-retention"]');
  }
}

class UsersListPo extends BaseResourceList {
  constructor(page: Page) {
    super(page, '.dashboard-root');
  }

  async create(): Promise<void> {
    await this.page.getByTestId('masthead-create').click();
  }

  refreshGroupMembership(): ComponentPo {
    return new ComponentPo(this.page, '[data-testid="action-button-async-button"]');
  }

  deactivate(): Locator {
    return this.page.getByTestId('sortable-table-deactivate');
  }

  activate(): Locator {
    return this.page.getByTestId('sortable-table-activate');
  }

  async openBulkActionDropdown(): Promise<void> {
    await this.resourceTable().sortableTable().bulkActionDropDownOpen();
  }

  bulkActionButton(name: string): Locator {
    return this.resourceTable().sortableTable().bulkActionDropDownButton(name);
  }

  selectAll(): ComponentPo {
    return this.resourceTable().sortableTable().selectAllCheckbox();
  }

  elementWithName(name: string): Locator {
    return this.resourceTable().sortableTable().rowElementWithName(name);
  }

  details(name: string, index: number): Locator {
    return this.resourceTable().sortableTable().rowWithName(name).column(index);
  }

  async clickRowActionMenuItem(name: string, itemLabel: string): Promise<void> {
    const menu = await this.resourceTable().sortableTable().rowActionMenuOpen(name);

    await menu.getMenuItem(itemLabel).click();
  }
}
