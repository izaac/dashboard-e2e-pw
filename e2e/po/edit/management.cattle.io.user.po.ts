import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';

export default class MgmtUserEditPo extends PagePo {
  private static createPath(clusterId: string, userId?: string) {
    const root = `/c/${clusterId}/auth/management.cattle.io.user`;

    return userId ? `${root}/${userId}?mode=edit` : `${root}/create`;
  }

  constructor(page: Page, clusterId = '_', userId?: string) {
    super(page, MgmtUserEditPo.createPath(clusterId, userId));
  }

  username(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Username');
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }
}
