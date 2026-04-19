import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import ResourceListMastheadPo from '@/e2e/po/components/resource-list-masthead.po';
import CreateEditViewPo from '@/e2e/po/components/create-edit-view.po';

export class PersistentVolumesListPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/persistentvolume`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, PersistentVolumesListPagePo.createPath(clusterId));
  }

  masthead(): ResourceListMastheadPo {
    return new ResourceListMastheadPo(this.page, ':scope');
  }

  sortableTable(): SortableTablePo {
    return new SortableTablePo(this.page, '.sortable-table');
  }

  createEditView(): CreateEditViewPo {
    return new CreateEditViewPo(this.page, '.dashboard-root');
  }
}
