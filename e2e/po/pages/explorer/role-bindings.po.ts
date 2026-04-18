import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';

export class RoleBindingsPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/rbac.authorization.k8s.io.rolebinding`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, RoleBindingsPagePo.createPath(clusterId));
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, ':scope', this.self());
  }

  async clickCreate(): Promise<void> {
    await this.list().masthead().createYaml();
  }
}
