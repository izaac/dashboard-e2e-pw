import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';

export default class ClusterManagerCreatePagePo extends PagePo {
  private static createPath(clusterId: string, queryParams?: string) {
    const base = `/c/${clusterId}/manager/provisioning.cattle.io.cluster/create`;

    return queryParams ? `${base}?${queryParams}` : base;
  }

  constructor(page: Page, clusterId = '_', queryParams?: string) {
    super(page, ClusterManagerCreatePagePo.createPath(clusterId, queryParams));
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  rke2PageTitle(): Locator {
    return this.self().locator('.title-bar h1.title, .primaryheader h1');
  }

  async selectCreate(index: number): Promise<void> {
    await this.resourceDetail().cruResource().self()
      .locator('.subtypes-container > div').nth(1)
      .locator('.item').nth(index)
      .click();
  }
}
