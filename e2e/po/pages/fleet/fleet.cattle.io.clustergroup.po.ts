import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import ResourceTablePo from '@/e2e/po/components/resource-table.po';

export class FleetClusterGroupsListPagePo extends PagePo {
  constructor(page: Page, clusterId = '_') {
    super(page, `/c/${clusterId}/fleet/fleet.cattle.io.clustergroup`);
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="sortable-table-list-container"]');
  }

  baseResourceList(): BaseResourceList {
    return new BaseResourceList(this.page, ':scope', this.self());
  }

  resourceTableDetails(name: string, index: number) {
    return this.list().resourceTable().resourceTableDetails(name, index);
  }

  async goToDetailsPage(name: string, selector?: string): Promise<void> {
    await this.list().resourceTable().goToDetailsPage(name, selector);
  }
}

export class FleetClusterGroupsCreateEditPo extends PagePo {
  private static createPath(workspace?: string, id?: string) {
    const root = '/c/_/fleet/fleet.cattle.io.clustergroup';

    return id ? `${root}/${workspace}/${id}` : `${root}/create`;
  }

  constructor(page: Page, workspace?: string, id?: string) {
    super(page, FleetClusterGroupsCreateEditPo.createPath(workspace, id));
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }
}

export class FleetClusterGroupDetailsPo extends PagePo {
  private static createPath(fleetWorkspace: string, clusterGroup: string) {
    return `/c/_/fleet/fleet.cattle.io.clustergroup/${fleetWorkspace}/${clusterGroup}`;
  }

  constructor(page: Page, fleetWorkspace: string, clusterGroup: string) {
    super(page, FleetClusterGroupDetailsPo.createPath(fleetWorkspace, clusterGroup));
  }

  clusterList(): ResourceTablePo {
    return new ResourceTablePo(this.page, '#clusters [data-testid="sortable-table-list-container"]');
  }
}
