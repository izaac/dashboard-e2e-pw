import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';

export class IngressListPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/networking.k8s.io.ingress`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, IngressListPagePo.createPath(clusterId));
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, ':scope', this.self());
  }

  baseResourceList(): BaseResourceList {
    return this.list();
  }
}
