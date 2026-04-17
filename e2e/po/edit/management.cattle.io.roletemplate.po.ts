import type { Page } from '@playwright/test';
import RoleEditPo from '@/e2e/po/edit/role.po';

export default class RoleTemplateEditPo extends RoleEditPo {
  constructor(page: Page, clusterId = '_', roleId?: string) {
    super(page, clusterId, 'management.cattle.io.roletemplate', roleId);
  }
}
