import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';

export class FleetClusterListPagePo extends PagePo {
  static readonly url = '/c/_/fleet/fleet.cattle.io.cluster';

  constructor(page: Page) {
    super(page, FleetClusterListPagePo.url);
  }

  static async navTo(page: Page): Promise<void> {
    await page.goto(`./c/_/fleet/fleet.cattle.io.cluster`, { waitUntil: 'domcontentloaded' });
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="sortable-table-list-container"]');
  }

  resourceTableDetails(name: string, column: number): Locator {
    return this.sortableTable().self().locator(`tr:has-text("${name}") td`).nth(column);
  }

  sortableTable(): SortableTablePo {
    return new SortableTablePo(this.page, '[data-testid="sortable-table-list-container"]');
  }

  mainRows(): Locator {
    return this.sortableTable().self().locator('tr.main-row');
  }

  async goToDetailsPage(name: string): Promise<void> {
    await this.sortableTable().detailsPageLinkWithName(name).click();
  }

  editFleetCluster(workspace: string | undefined, clusterName: string): FleetClusterEditPo {
    return new FleetClusterEditPo(this.page, workspace ?? 'fleet-default', clusterName);
  }
}

export class FleetClusterDetailsPo extends PagePo {
  private static createPath(fleetWorkspace: string, clusterName: string): string {
    return `/c/_/fleet/fleet.cattle.io.cluster/${fleetWorkspace}/${clusterName}`;
  }

  constructor(page: Page, fleetWorkspace: string, clusterName: string) {
    super(page, FleetClusterDetailsPo.createPath(fleetWorkspace, clusterName));
  }

  clusterTabs(): TabbedPo {
    return new TabbedPo(this.page, '[data-testid="tabbed-block"]');
  }

  appBundlesList(): SortableTablePo {
    return new SortableTablePo(this.page, '#applications [data-testid="sortable-table-list-container"]');
  }

  addAppButton(): Locator {
    return this.self().locator('.btn:has-text("Create App Bundle")');
  }

  clusterLabels(): Locator {
    return this.self().locator('.tag-data');
  }

  flatListViewButton(): Locator {
    return this.page.getByTestId('group-by-button-0');
  }
}

export class FleetClusterEditPo extends PagePo {
  private static createPath(fleetWorkspace: string, clusterName: string): string {
    return `/c/_/fleet/fleet.cattle.io.cluster/${fleetWorkspace}/${clusterName}`;
  }

  constructor(page: Page, fleetWorkspace = 'fleet-default', clusterName: string) {
    super(page, FleetClusterEditPo.createPath(fleetWorkspace, clusterName));
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }
}
