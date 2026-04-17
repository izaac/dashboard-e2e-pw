import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';

export default abstract class RoleDetailPo extends PagePo {
  private static createPath(clusterId: string, resource: string, roleId: string) {
    return `/c/${clusterId}/auth/roles/${resource}/${roleId}`;
  }

  constructor(page: Page, clusterId = '_', resource: string, roleId: string) {
    super(page, RoleDetailPo.createPath(clusterId, resource, roleId));
  }
}
