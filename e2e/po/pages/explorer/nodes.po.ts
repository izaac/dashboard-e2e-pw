import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import ResourceListMastheadPo from '@/e2e/po/components/resource-list-masthead.po';

export class NodesListPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/node`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, NodesListPagePo.createPath(clusterId));
  }

  masthead(): ResourceListMastheadPo {
    return new ResourceListMastheadPo(this.page, ':scope');
  }

  sortableTable(): SortableTablePo {
    return new SortableTablePo(this.page, '[data-testid="cluster-node-list"] .sortable-table');
  }
}
