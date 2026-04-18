import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';

export class LeasesPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/coordination.k8s.io.lease`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, LeasesPagePo.createPath(clusterId));
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '.dashboard-root');
  }

  async clickCreateYaml(): Promise<void> {
    await this.list().masthead().createYaml();
  }

  listElementWithName(name: string): Locator {
    return this.list().resourceTable().sortableTable().rowElementWithName(name);
  }

  saveYamlButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="action-button-async-button"]', this.self());
  }
}
