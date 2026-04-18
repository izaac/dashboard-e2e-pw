import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import MachinePoolsListPo from '@/e2e/po/lists/machine-pools-list.po';
import ClusterSnapshotsListPo from '@/e2e/po/lists/cluster-snapshots-list.po';
import ClusterRecentEventsListPo from '@/e2e/po/lists/cluster-recent-events-list.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';

export default class ClusterManagerDetailRke2AmazonEc2PagePo extends PagePo {
  private static createPath(clusterId: string, clusterName: string): string {
    const namespace = clusterName === 'local' ? 'fleet-local' : 'fleet-default';

    return `/c/${clusterId}/manager/provisioning.cattle.io.cluster/${namespace}/${clusterName}`;
  }

  constructor(page: Page, clusterId = '_', clusterName: string) {
    super(page, ClusterManagerDetailRke2AmazonEc2PagePo.createPath(clusterId, clusterName));
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  poolsList(tabId: 'machine' | 'node'): MachinePoolsListPo {
    return new MachinePoolsListPo(
      this.page,
      `[data-testid="sortable-table-list-container"]`,
      this.self().locator(`#${tabId}-pools`),
    );
  }

  snapshotsList(): ClusterSnapshotsListPo {
    return new ClusterSnapshotsListPo(this.page, '[data-testid="cluster-snapshots-list"]', this.self());
  }

  recentEventsList(): ClusterRecentEventsListPo {
    return new ClusterRecentEventsListPo(this.page, '.sortable-table', this.self());
  }

  async selectTab(tabbedPo: TabbedPo, selector: string): Promise<void> {
    await tabbedPo.clickTabWithSelector(selector);
  }

  title(): Locator {
    return this.self().locator('.title-bar h1.title, .primaryheader h1');
  }
}
