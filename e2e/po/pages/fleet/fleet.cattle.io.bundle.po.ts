import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import ResourceTablePo from '@/e2e/po/components/resource-table.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';

export class FleetBundlesListPagePo extends PagePo {
  static url = '/c/_/fleet/fleet.cattle.io.bundle';

  constructor(page: Page) {
    super(page, FleetBundlesListPagePo.url);
  }

  baseResourceList(): BaseResourceList {
    return new BaseResourceList(this.page, ':scope', this.self());
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="sortable-table-list-container"]');
  }

  resourceTableDetails(name: string, index: number): Locator {
    return this.baseResourceList().resourceTable().resourceTableDetails(name, index);
  }

  async goToDetailsPage(name: string, selector?: string): Promise<void> {
    await this.baseResourceList().resourceTable().goToDetailsPage(name, selector);
  }
}

export class FleetBundlesCreateEditPo extends PagePo {
  private static createPath(workspace?: string, id?: string) {
    const root = '/c/_/fleet/fleet.cattle.io.bundle';

    return id ? `${root}/${workspace}/${id}` : `${root}/create`;
  }

  constructor(page: Page, workspace?: string, id?: string) {
    super(page, FleetBundlesCreateEditPo.createPath(workspace, id));
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }
}

export class FleetBundleDetailsPo extends PagePo {
  private static createPath(fleetWorkspace: string, bundleName: string) {
    return `/c/_/fleet/fleet.cattle.io.bundle/${fleetWorkspace}/${bundleName}`;
  }

  constructor(page: Page, fleetWorkspace: string, bundleName: string) {
    super(page, FleetBundleDetailsPo.createPath(fleetWorkspace, bundleName));
  }

  tabs(): TabbedPo {
    return new TabbedPo(this.page);
  }

  resourcesList(): ResourceTablePo {
    // Detail page has multiple sortable-table-list-container elements (Resources, Conditions, Events tabs).
    // Scope to the first one (Resources tab, active by default).
    const firstContainer = this.self().locator('[data-testid="sortable-table-list-container"]').first();

    return new ResourceTablePo(this.page, ':scope', firstContainer);
  }
}
