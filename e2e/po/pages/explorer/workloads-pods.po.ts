import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import CreateEditViewPo from '@/e2e/po/components/create-edit-view.po';
import ResourceListMastheadPo from '@/e2e/po/components/resource-list-masthead.po';

export class WorkloadsPodsListPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/pod`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, WorkloadsPodsListPagePo.createPath(clusterId));
  }

  baseResourceList(): BaseResourceList {
    return new BaseResourceList(this.page, '.dashboard-root');
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

  /** Page-level search box — works even in grouped views where the filter is outside .sortable-table */
  searchBox(): Locator {
    return this.page.getByRole('searchbox', { name: 'Filter table results' });
  }

  async filterBySearchBox(text: string): Promise<void> {
    const box = this.searchBox();

    await box.focus();
    await box.clear();
    await box.fill(text);
  }

  /** Flat List button — switches from grouped to flat view */
  flatListButton(): Locator {
    return this.page.getByRole('button', { name: 'Flat List' });
  }
}

export class WorkloadsPodsDetailPagePo extends PagePo {
  private static createPath(namespace: string, podName: string, clusterId: string) {
    return `/c/${clusterId}/explorer/pod/${namespace}/${podName}`;
  }

  constructor(page: Page, namespace: string, podName: string, clusterId = 'local') {
    super(page, WorkloadsPodsDetailPagePo.createPath(namespace, podName, clusterId));
  }

  createEditView(): CreateEditViewPo {
    return new CreateEditViewPo(this.page, '.dashboard-root');
  }
}
