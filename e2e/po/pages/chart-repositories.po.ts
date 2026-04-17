import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
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

  async create(): Promise<void> {
    await this.list().masthead().actions().filter({ hasText: 'Add Repository' }).click();
  }

  createEditRepositories(): ChartRepositoriesCreateEditPo {
    return new ChartRepositoriesCreateEditPo(this.page, this.clusterId, this.product);
  }
}
