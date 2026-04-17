import type { Page } from '@playwright/test';
import RoleEditPo from '@/e2e/po/edit/role.po';
import CodeMirrorPo from '@/e2e/po/components/code-mirror.po';

export default class GlobalRoleEditPo extends RoleEditPo {
  constructor(page: Page, clusterId = '_', roleId?: string) {
    super(page, clusterId, 'management.cattle.io.globalrole', roleId);
  }

  yamlEditor(): CodeMirrorPo {
    return CodeMirrorPo.bySelector(this.page, this.self(), '[data-testid="yaml-editor-code-mirror"]');
  }
}
