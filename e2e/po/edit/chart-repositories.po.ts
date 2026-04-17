import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import KeyValuePo from '@/e2e/po/components/key-value.po';

export default class ChartRepositoriesCreateEditPo extends PagePo {
  private static createPath(clusterId: string, product: 'apps' | 'manager', repoName?: string) {
    const root = `/c/${clusterId}/${product}/catalog.cattle.io.clusterrepo`;

    return repoName ? `${root}/${repoName}` : `${root}/create`;
  }

  constructor(page: Page, clusterId = '_', product: 'apps' | 'manager' = 'manager', repoName?: string) {
    super(page, ChartRepositoriesCreateEditPo.createPath(clusterId, product, repoName));
  }

  lablesAnnotationsKeyValue(): KeyValuePo {
    return new KeyValuePo(this.page, ':scope', this.self());
  }
}
