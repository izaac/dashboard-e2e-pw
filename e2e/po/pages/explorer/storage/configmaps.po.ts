import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import ResourceListMastheadPo from '@/e2e/po/components/resource-list-masthead.po';
import CreateEditViewPo from '@/e2e/po/components/create-edit-view.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';

export class ConfigMapsListPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/configmap`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, ConfigMapsListPagePo.createPath(clusterId));
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '.dashboard-root');
  }

  masthead(): ResourceListMastheadPo {
    return new ResourceListMastheadPo(this.page, ':scope');
  }

  createEditView(): CreateEditViewPo {
    return new CreateEditViewPo(this.page, '.dashboard-root');
  }

  sortableTable(): SortableTablePo {
    return new SortableTablePo(this.page, '.sortable-table');
  }

  /** Page-level search box — works even in grouped views where the filter is outside .sortable-table */
  async filterBySearchBox(text: string): Promise<void> {
    const box = this.page.getByRole('searchbox', { name: 'Filter table results' });

    await box.focus();
    await box.clear();
    await box.fill(text);
  }
}
