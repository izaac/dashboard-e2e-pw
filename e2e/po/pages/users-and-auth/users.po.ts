import type { Page, Locator } from '@playwright/test';
import ClusterPagePo from '@/e2e/po/pages/cluster-page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import ComponentPo from '@/e2e/po/components/component.po';
import MgmtUserEditPo from '@/e2e/po/edit/management.cattle.io.user.po';

/**
 * Page object for Users & Authentication > Users page.
 */
export default class UsersPo extends ClusterPagePo {
  private clusterId: string;

  constructor(page: Page, clusterId = '_') {
    super(page, clusterId, 'auth/management.cattle.io.user');
    this.clusterId = clusterId;
  }

  list(): UsersListPo {
    return new UsersListPo(this.page);
  }

  createEdit(): MgmtUserEditPo {
    return new MgmtUserEditPo(this.page, this.clusterId);
  }

  userRetentionLink(): Locator {
    return this.self().locator('[data-testid="router-link-user-retention"]');
  }
}

class UsersListPo extends BaseResourceList {
  constructor(page: Page) {
    super(page, '.dashboard-root');
  }

  refreshGroupMembership(): ComponentPo {
    return new ComponentPo(this.page, '[data-testid="action-button-async-button"]');
  }
}
