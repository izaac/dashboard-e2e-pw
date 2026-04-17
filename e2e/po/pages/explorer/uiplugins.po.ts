import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ResourceTablePo from '@/e2e/po/components/resource-table.po';
import type { Locator } from '@playwright/test';

export default class UiPluginsPagePo extends PagePo {
  private static createPath(clusterId: string) {
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
}
