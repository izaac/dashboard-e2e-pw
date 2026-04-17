import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ComponentPo from '@/e2e/po/components/component.po';

export default class UserRetentionPo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/auth/user.retention`;
  }

  constructor(page: Page, clusterId = '_') {
    super(page, UserRetentionPo.createPath(clusterId));
  }

  disableAfterPeriodCheckbox(): ComponentPo {
    return new ComponentPo(this.page, '[data-testid="disableAfterPeriod"]');
  }
}
