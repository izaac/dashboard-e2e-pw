import type { Page } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';

export default class CertificatesPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '[data-testid="cluster-certs"]');
  }

  expiredBanner(): ComponentPo {
    return new ComponentPo(this.page, '#cluster-certs .banner.error');
  }

  expiringBanner(): ComponentPo {
    return new ComponentPo(this.page, '#cluster-certs .banner.warning');
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="sortable-table-list-container"]', this.self());
  }
}
