import type { Page } from '@playwright/test';
import { WorkloadsListPageBasePo } from '@/e2e/po/pages/explorer/workloads/workloads.po';
import ResourceListMastheadPo from '@/e2e/po/components/resource-list-masthead.po';

export class WorkloadsJobsListPagePo extends WorkloadsListPageBasePo {
  constructor(page: Page, clusterId = 'local') {
    super(page, clusterId, 'batch.job');
  }

  masthead(): ResourceListMastheadPo {
    return new ResourceListMastheadPo(this.page, ':scope');
  }
}
