import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';

export class ServiceAccountsPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/serviceaccount`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, ServiceAccountsPagePo.createPath(clusterId));
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '.dashboard-root');
  }

  async clickCreate(): Promise<void> {
    await this.list().masthead().create();
  }
}
