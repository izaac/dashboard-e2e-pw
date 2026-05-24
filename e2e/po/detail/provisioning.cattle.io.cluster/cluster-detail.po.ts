import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import MachinePoolsListPo from '@/e2e/po/lists/machine-pools-list.po';
import ClusterSnapshotsListPo from '@/e2e/po/lists/cluster-snapshots-list.po';
import ClusterRecentEventsListPo from '@/e2e/po/lists/cluster-recent-events-list.po';

/**
 * Common to the dashboard's cluster detail pages.
 * Ported from upstream cypress/e2e/po/detail/provisioning.cattle.io.cluster/cluster-detail.po.ts.
 *
 * Note: upstream additionally wraps ClusterConditionsListPo / ClusterReferredToListPo /
 * ClusterProvisioningLogPo / DetailDrawer — those PW POs are not yet ported, so this
 * base exposes raw locators (logsContainer, conditionsTable, referredToTable, detailDrawer)
 * that callers can chain. TODO(upstream-port): wrap when those list POs are added.
 */
export default abstract class ClusterManagerDetailPagePo extends PagePo {
  private static createPath(clusterId: string, clusterName: string): string {
    const namespace = clusterName === 'local' ? 'fleet-local' : 'fleet-default';

    return `/c/${clusterId}/manager/provisioning.cattle.io.cluster/${namespace}/${clusterName}`;
  }

  constructor(page: Page, clusterId = '_', clusterName: string) {
    super(page, ClusterManagerDetailPagePo.createPath(clusterId, clusterName));
  }

  title(): Locator {
    return this.self().locator('.title-bar h1.title, .primaryheader h1');
  }

  async openShowConfiguration(): Promise<void> {
    await this.self().getByTestId('show-configuration-cta').click();
  }

  detailDrawer(): Locator {
    return this.page.locator('aside.slide-in');
  }

  logsContainer(): Locator {
    return this.self().locator('.logs-container, [data-testid="logs-container"]');
  }

  /**
   * Registration command shown on the imported-cluster registration tab.
   * Upstream returns `this.self().get('code')` which targets the rendered
   * kubectl-apply snippet — PW equivalent is the first matching `code` element.
   */
  kubectlCommandForImported(): Locator {
    return this.self().locator('code');
  }

  poolsList(tabId: 'machine' | 'node'): MachinePoolsListPo {
    return new MachinePoolsListPo(
      this.page,
      '[data-testid="sortable-table-list-container"]',
      this.self().locator(`#${tabId}-pools`),
    );
  }

  /** Raw conditions table — upstream wraps in ClusterConditionsListPo. */
  conditionsTable(): Locator {
    return this.self().locator('.sortable-table');
  }

  /** Raw referred-to table — upstream wraps in ClusterReferredToListPo. */
  referredToTable(): Locator {
    return this.self().locator('[data-testid="sortable-table-list-container"]');
  }

  snapshotsList(): ClusterSnapshotsListPo {
    return new ClusterSnapshotsListPo(this.page, '[data-testid="cluster-snapshots-list"]', this.self());
  }

  recentEventsList(): ClusterRecentEventsListPo {
    return new ClusterRecentEventsListPo(this.page, '.sortable-table', this.self());
  }

  async selectTab(options: TabbedPo, selector: string): Promise<this> {
    await options.tabBySelector(selector).click();

    return this;
  }

  namespace(): Locator {
    return this.page.getByTestId('masthead-subheader-namespace');
  }

  exploreButton(): Locator {
    return this.page.getByTestId('detail-explore-button');
  }
}
