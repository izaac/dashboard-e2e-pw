import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import ResourceListMastheadPo from '@/e2e/po/components/resource-list-masthead.po';

export class APIServicesPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/apiregistration.k8s.io.apiservice`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, APIServicesPagePo.createPath(clusterId));
  }

  resourcesList(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="sortable-table-list-container"]');
  }

  sortableTable(): SortableTablePo {
    return this.resourcesList().resourceTable().sortableTable();
  }

  title(): ResourceListMastheadPo {
    return this.resourcesList().masthead();
  }
}
