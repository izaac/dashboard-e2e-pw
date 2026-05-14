import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';

export class ConfigMapsPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/configmap`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, ConfigMapsPagePo.createPath(clusterId));
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '.dashboard-root');
  }
}

export class ConfigMapDetailPagePo extends PagePo {
  private static createPath(clusterId: string, namespace: string, name: string) {
    return `/c/${clusterId}/explorer/configmap/${namespace}/${name}`;
  }

  constructor(page: Page, clusterId: string, namespace: string, name: string) {
    super(page, ConfigMapDetailPagePo.createPath(clusterId, namespace, name));
  }

  private titleBar(): Locator {
    return this.self().locator('.title-bar h1.title');
  }

  resourceName(): Locator {
    return this.titleBar().locator('.resource-name');
  }

  badgeState(): Locator {
    return this.titleBar().locator('.badge-state');
  }
}
