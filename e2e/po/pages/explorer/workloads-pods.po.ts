import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import CreateEditViewPo from '@/e2e/po/components/create-edit-view.po';
import ResourceListMastheadPo from '@/e2e/po/components/resource-list-masthead.po';
import TableViewsPo from '@/e2e/po/components/table-views.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import ResourceTablePo from '@/e2e/po/components/resource-table.po';

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

  tableViews(): TableViewsPo {
    return new TableViewsPo(this.page);
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

  /** The bar a stateFilter link leaves above the list while the configurable tables feature flag is off */
  stateFilterBar(): Locator {
    return this.page.locator('.state-filter-bar').filter({ hasText: 'State filter applied' });
  }

  /** The bar a nameFilter link leaves above the list while the configurable tables feature flag is off */
  nameFilterBar(): Locator {
    return this.page.locator('.state-filter-bar').filter({ hasText: 'Name filter applied' });
  }

  async clearStateFilter(): Promise<void> {
    await this.stateFilterBar().getByRole('button', { name: 'Clear filter' }).click();
  }

  async clearNameFilter(): Promise<void> {
    await this.nameFilterBar().getByRole('button', { name: 'Clear filter' }).click();
  }

  /**
   * Resolves with the `filter` parameters of the next pods list request (a page of the list, not a summary or a
   * search) that filters on the given field. Start it before the action that causes the request.
   *
   * Pass `expected` to wait for the request carrying every one of those filters, joined with a space: the page can
   * issue more than one list request while a filter settles (a single state first, the whole set after), and only
   * the last one has the full set.
   */
  async waitForListRequestFilters(field: string, expected: string[] = []): Promise<string[]> {
    const request = await this.page.waitForRequest((req) => {
      const url = new URL(req.url());

      if (!url.pathname.endsWith('/v1/pods') || !url.searchParams.has('pagesize')) {
        return false;
      }

      const filters = url.searchParams.getAll('filter');
      const joined = filters.join(' ');

      return filters.some((filter) => filter.startsWith(field)) && expected.every((filter) => joined.includes(filter));
    });

    return new URL(request.url()).searchParams.getAll('filter');
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

  async goToClone(): Promise<void> {
    await this.goTo('mode=clone');
  }

  private tabs(): TabbedPo {
    return new TabbedPo(this.page);
  }

  async clickStorageTab(): Promise<void> {
    await this.tabs().tab('storage').click();
  }

  storageTabPanel(): Locator {
    return this.tabs().panel('storage');
  }

  storageList(): ResourceTablePo {
    return this.tabs().tabbedList('storage');
  }

  /** The Pod Storage tab renders its empty message as a bare `<p>`, without the `caption` class workloads use */
  storageEmptyMessage(): Locator {
    return this.storageTabPanel().locator('p');
  }
}
