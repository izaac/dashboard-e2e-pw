import type { Page } from '@playwright/test';
import RoleDetailPo from '@/e2e/po/detail/role.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import ActionMenuPo from '@/e2e/po/components/action-menu.po';
import GlobalRoleEditPo from '@/e2e/po/edit/management.cattle.io.globalrole.po';

class GlobalRoleDetailComponentPo extends ResourceDetailPo {
  userCreateEditView(clusterId: string, userId?: string): GlobalRoleEditPo {
    return new GlobalRoleEditPo(this.page, clusterId, userId);
  }

  async openMastheadActionMenu(): Promise<ActionMenuPo> {
    await this.self().locator('[data-testid="masthead-action-menu"]').click();

    return new ActionMenuPo(this.page);
  }
}

export default class GlobalRoleDetailPo extends RoleDetailPo {
  constructor(page: Page, clusterId = '_', roleId: string) {
    super(page, clusterId, 'management.cattle.io.globalrole', roleId);
  }

  detail(): GlobalRoleDetailComponentPo {
    return new GlobalRoleDetailComponentPo(this.page, ':scope', this.self());
  }
}
