import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import ResourceTablePo from '@/e2e/po/components/resource-table.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';

export class FleetWorkspaceListPagePo extends PagePo {
  static url = '/c/_/fleet/management.cattle.io.fleetworkspace';

  constructor(page: Page) {
    super(page, FleetWorkspaceListPagePo.url);
  }

  baseResourceList(): BaseResourceList {
    return new BaseResourceList(this.page, ':scope', this.self());
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="sortable-table-list-container"]');
  }

  async goToDetailsPage(name: string, selector?: string): Promise<void> {
    await this.baseResourceList().resourceTable().goToDetailsPage(name, selector);
  }
}

export class FleetWorkspaceCreateEditPo extends PagePo {
  private static createPath(fleetWorkspace?: string) {
    const root = '/c/_/fleet/management.cattle.io.fleetworkspace';

    return fleetWorkspace ? `${root}/${fleetWorkspace}` : `${root}/create`;
  }

  constructor(page: Page, fleetWorkspace?: string) {
    super(page, FleetWorkspaceCreateEditPo.createPath(fleetWorkspace));
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }
}

export class FleetWorkspaceDetailsPo extends PagePo {
  private static createPath(fleetWorkspace: string) {
    return `/c/_/fleet/management.cattle.io.fleetworkspace/${fleetWorkspace}`;
  }

  constructor(page: Page, fleetWorkspace: string) {
    super(page, FleetWorkspaceDetailsPo.createPath(fleetWorkspace));
  }

  workspaceTabs(): TabbedPo {
    return new TabbedPo(this.page);
  }

  recentEventsList(): ResourceTablePo {
    return new ResourceTablePo(this.page, '#events [data-testid="sortable-table-list-container"]');
  }

  relatedResourcesList(index: number): ResourceTablePo {
    return new ResourceTablePo(
      this.page,
      `#related div:nth-of-type(${index})[data-testid="sortable-table-list-container"]`,
    );
  }
}
