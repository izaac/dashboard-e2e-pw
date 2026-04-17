import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ResourceTablePo from '@/e2e/po/components/resource-table.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import type { Locator } from '@playwright/test';

export default class UiPluginsPagePo extends PagePo {
  static createPath(clusterId: string): string {
    return `/c/${clusterId}/explorer/catalog.cattle.io.uiplugin`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, UiPluginsPagePo.createPath(clusterId));
  }

  resourceTable(): ResourceTablePo {
    return new ResourceTablePo(this.page, '[data-testid="sortable-table-list-container"]');
  }

  cacheState(name: string): Locator {
    return this.resourceTable().sortableTable().rowWithName(name).column(5);
  }

  async goToDetailsPage(elemName: string): Promise<void> {
    await this.resourceTable().sortableTable().detailsPageLinkWithName(elemName).click();
  }

  async clickCreate(): Promise<void> {
    const baseResourceList = new BaseResourceList(this.page, ':scope', this.self());

    await baseResourceList.masthead().create();
  }
}
