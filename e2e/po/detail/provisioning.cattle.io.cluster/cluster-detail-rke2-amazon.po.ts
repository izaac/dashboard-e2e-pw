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

  eventsTab(): Locator {
    return this.page.getByTestId('btn-events');
  }

  snapshotsTab(): Locator {
    return this.page.getByTestId('btn-snapshots');
  }

  conditionsTab(): Locator {
    return this.page.getByTestId('btn-conditions');
  }

  relatedTab(): Locator {
    return this.page.getByTestId('btn-related');
  }

  logTab(): Locator {
    return this.page.getByTestId('btn-log');
  }

  nodePoolsTab(): Locator {
    return this.page.getByTestId('btn-node-pools');
  }

  tabbedBlock(): Locator {
    return this.page.getByTestId('tabbed-block');
  }

  showConfigurationButton(): Locator {
    return this.page.locator('button:has-text("Show Configuration"), [data-testid="show-configuration"]');
  }

  configurationDrawer(): Locator {
    return this.page.locator('[data-testid="detail-drawer"], .side-panel');
  }

  clusterNamespaceLink(): Locator {
    return this.page.getByTestId('cluster-namespace');
  }

  nameInput(): Locator {
    return this.page.locator('[data-testid="name-ns-description"] input[id*="name"]').first();
  }

  cancelButton(): Locator {
    return this.page.locator('button:has-text("Cancel"), [data-testid="cancel-button"]');
  }

  kubectlShell(): Locator {
    return this.page.locator('.terminal, [data-testid="kubectl-shell"]');
  }

  closeShellButton(): Locator {
    return this.page.locator(
      '[data-testid="close-shell-button"], .btn:has-text("Close"), [data-testid="wm-tab-close-button"], .wm-closer-button',
    );
  }

  logsContainer(): Locator {
    return this.page.locator('.logs-container, [data-testid="logs-container"]');
  }

  exploreButton(): Locator {
    return this.page.locator('[data-testid="explore-button"], button:has-text("Explore")');
  }

  shellStatus(): Locator {
    return this.page.locator('.container-shell .status');
  }

  conditionRow(name: string): Locator {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    return this.page.locator('tr').filter({
      has: this.page.locator('td').filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`) }),
    });
  }

  drawerSaveButton(): Locator {
    return this.configurationDrawer().locator('button:has-text("Save")');
  }

  drawerConfigTab(): Locator {
    return this.configurationDrawer().locator('[data-testid="tab-config"], button:has-text("Config")');
  }

  drawerYamlTab(): Locator {
    return this.configurationDrawer().locator('[data-testid="tab-yaml"], button:has-text("YAML")');
  }

  tableRowCell(rowText: string, cellIndex: number): Locator {
    return this.page.locator(`tr:has-text("${rowText}") td`).nth(cellIndex);
  }

  tableRowContaining(text: string): Locator {
    return this.page.locator(`tr:has-text("${text}")`);
  }
}
