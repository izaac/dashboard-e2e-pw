import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';

export default class ClusterManagerListPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/manager/provisioning.cattle.io.cluster`;
  }

  constructor(page: Page, clusterId = '_') {
    super(page, ClusterManagerListPagePo.createPath(clusterId));
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="cluster-list"]');
  }

  async createCluster(): Promise<void> {
    await this.list().masthead().actions().nth(1).click();
  }
}
