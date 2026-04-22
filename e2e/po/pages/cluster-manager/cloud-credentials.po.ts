import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import CloudCredentialsCreateEditPo from '@/e2e/po/edit/cloud-credentials-amazon.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';

export default class CloudCredentialsPagePo extends PagePo {
  private static createPath(clusterId: string): string {
    return `/c/${clusterId}/manager/cloudCredential`;
  }

  constructor(page: Page, clusterId = '_') {
    super(page, CloudCredentialsPagePo.createPath(clusterId));
  }

  async create(): Promise<void> {
    await this.list().masthead().create();
  }

  createEditCloudCreds(id?: string): CloudCredentialsCreateEditPo {
    return new CloudCredentialsCreateEditPo(this.page, '_', id);
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="sortable-table-list-container"]');
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }
}
