import type { Page } from '@playwright/test';
import ClusterPagePo from '@/e2e/po/pages/cluster-page.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import GlobalRoleEditPo from '@/e2e/po/edit/management.cattle.io.globalrole.po';
import GlobalRoleDetailPo from '@/e2e/po/detail/management.cattle.io.globalrole.po';
import RoleTemplateEditPo from '@/e2e/po/edit/management.cattle.io.roletemplate.po';
import RoleTemplateDetailPo from '@/e2e/po/detail/management.cattle.io.roletemplate.po';
import RoleListPo from '@/e2e/po/lists/role-list.po';

/**
 * Page object for Users & Authentication > Role Templates page.
 */
export default class RolesPo extends ClusterPagePo {
  private clusterId: string;

  constructor(page: Page, clusterId = '_') {
    super(page, clusterId, 'auth/roles');
    this.clusterId = clusterId;
  }

  /** Get the resource list container for a given tab */
  list(tabIdSelector: 'GLOBAL' | 'CLUSTER' | 'NAMESPACE'): RoleListPo {
    return new RoleListPo(this.page, `#${tabIdSelector} [data-testid="sortable-table-list-container"]`);
  }

  tabs(): TabbedPo {
    return new TabbedPo(this.page, '[data-testid="tabbed-block"]');
  }

  async waitForRequests(): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes('/v1/management.cattle.io.roletemplates') && resp.status() === 200,
    );

    await this.goTo();
    await responsePromise;
  }

  createGlobal(roleId?: string): GlobalRoleEditPo {
    return new GlobalRoleEditPo(this.page, this.clusterId, roleId);
  }

  detailGlobal(roleId: string): GlobalRoleDetailPo {
    return new GlobalRoleDetailPo(this.page, this.clusterId, roleId);
  }

  createRole(roleId?: string): RoleTemplateEditPo {
    return new RoleTemplateEditPo(this.page, this.clusterId, roleId);
  }

  detailRole(roleId: string): RoleTemplateDetailPo {
    return new RoleTemplateDetailPo(this.page, this.clusterId, roleId);
  }

  async goToEditYamlPage(elemName: string): Promise<void> {
    const actionMenu = await this.list('GLOBAL').actionMenu(elemName);

    await actionMenu.getMenuItem('Edit YAML').click();
  }

  async listCreate(label: string): Promise<void> {
    await this.page
      .locator('.actions-container .actions .btn, .resource-list-masthead .actions .btn')
      .getByText(label)
      .click();
  }
}
