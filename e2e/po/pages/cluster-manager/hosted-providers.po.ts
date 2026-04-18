import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';

export default class HostedProvidersPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/manager/hostedprovider`;
  }

  constructor(page: Page, clusterId = '_') {
    super(page, HostedProvidersPagePo.createPath(clusterId));
  }

  title(): Locator {
    return this.page.locator('.title > h1').filter({ hasText: 'Hosted Providers' });
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="hosted-provider-list"]');
  }
}
