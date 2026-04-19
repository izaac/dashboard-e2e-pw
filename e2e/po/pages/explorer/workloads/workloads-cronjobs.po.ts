import type { Page } from '@playwright/test';
import { WorkloadsListPageBasePo } from '@/e2e/po/pages/explorer/workloads/workloads.po';

export class WorkloadsCronJobsListPagePo extends WorkloadsListPageBasePo {
  constructor(page: Page, clusterId = 'local') {
    super(page, clusterId, 'cronjobs');
  }
}
