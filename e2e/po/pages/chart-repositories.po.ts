import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import ChartRepositoriesCreateEditPo from '@/e2e/po/edit/chart-repositories.po';

export default class ChartRepositoriesPagePo extends PagePo {
  private static createPath(clusterId: string, product: 'apps' | 'manager') {
    return `/c/${clusterId}/${product}/catalog.cattle.io.clusterrepo`;
  }

  private clusterId: string;
  private product: 'apps' | 'manager';

  constructor(page: Page, clusterId = '_', product: 'apps' | 'manager' = 'manager') {
    super(page, ChartRepositoriesPagePo.createPath(clusterId, product));
    this.clusterId = clusterId;
    this.product = product;
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="app-cluster-repo-list"]');
  }

  sortableTable(): SortableTablePo {
    return this.list().resourceTable().sortableTable();
  }

  async create(): Promise<void> {
    await this.page.getByTestId('masthead-create').click();
  }

  createEditRepositories(repoName?: string): ChartRepositoriesCreateEditPo {
    return new ChartRepositoriesCreateEditPo(this.page, this.clusterId, this.product, repoName);
  }

  async waitForGoTo(endpoint: string): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes(endpoint) && resp.request().method() === 'GET' && resp.status() === 200,
      { timeout: 15000 },
    );

    await this.goTo();
    await responsePromise;
  }
}
