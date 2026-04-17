import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import OidcClientsListPo from '@/e2e/po/lists/management.cattle.io.oidcclient-list.po';

export default class OidcClientsPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/auth/management.cattle.io.oidcclient`;
  }

  constructor(page: Page, clusterId = '_') {
    super(page, OidcClientsPagePo.createPath(clusterId));
  }

  async createOidcClient(): Promise<void> {
    await this.list().masthead().actions().first().click();
  }

  list(): OidcClientsListPo {
    return new OidcClientsListPo(this.page);
  }
}
