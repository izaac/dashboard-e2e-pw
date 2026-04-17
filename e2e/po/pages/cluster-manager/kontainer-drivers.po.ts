import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';

export default class KontainerDriversPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/manager/kontainerDriver`;
  }

  constructor(page: Page, clusterId = '_') {
    super(page, KontainerDriversPagePo.createPath(clusterId));
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="kontainer-driver-list"]');
  }
}
