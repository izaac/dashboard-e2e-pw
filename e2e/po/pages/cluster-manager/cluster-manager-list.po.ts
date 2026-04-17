import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';

export default class ClusterManagerListPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/manager/provisioning.cattle.io.cluster`;
  }

  constructor(page: Page, clusterId = '_') {
    super(page, ClusterManagerListPagePo.createPath(clusterId));
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="cluster-list"]');
  }

  sortableTable(): SortableTablePo {
    return this.list().resourceTable().sortableTable();
  }

  async importCluster(): Promise<void> {
    await this.list().masthead().actions().nth(0).click();
  }

  async createCluster(): Promise<void> {
    await this.list().masthead().actions().nth(1).click();
  }

  async editCluster(name: string): Promise<void> {
    const actionMenu = await this.sortableTable().rowActionMenuOpen(name);

    await actionMenu.getMenuItem('Edit Config').click();
  }

  capiWarningSubRow(clusterName: string): Locator {
    return this.list().self().locator(`[data-testid="capi-unsupported-warning-${clusterName}"]`);
  }

  async goToClusterListAndGetClusterDetails(clusterName: string): Promise<{ id: string }> {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes('/v3/clusters') && resp.request().method() === 'GET' && resp.status() === 200,
      { timeout: 10000 },
    );

    await this.goTo();
    const response = await responsePromise;
    const body = await response.json();

    return body.data.find((c: any) => c.name === clusterName);
  }
}
