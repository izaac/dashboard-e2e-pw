import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';

export class SecretsListPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/secret`;
  }

  constructor(page: Page, clusterId: string) {
    super(page, SecretsListPagePo.createPath(clusterId));
  }

  createButton(): Locator {
    return this.self().locator('[data-testid="secrets-list-create"]');
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="sortable-table-list-container"]');
  }
}

export class SecretsCreateEditPo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/secret/create`;
  }

  constructor(page: Page, clusterId: string) {
    super(page, SecretsCreateEditPo.createPath(clusterId));
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }
}
