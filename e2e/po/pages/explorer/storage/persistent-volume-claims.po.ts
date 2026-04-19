import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';

export class PersistentVolumeClaimsListPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/persistentvolumeclaim`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, PersistentVolumeClaimsListPagePo.createPath(clusterId));
  }

  sortableTable(): SortableTablePo {
    return new SortableTablePo(this.page, '.sortable-table');
  }
}
