import type { Page } from '@playwright/test';
import { WorkloadsListPageBasePo, WorkloadDetailsPageBasePo } from '@/e2e/po/pages/explorer/workloads/workloads.po';

export class WorkloadsCronJobsListPagePo extends WorkloadsListPageBasePo {
  constructor(page: Page, clusterId = 'local') {
    super(page, clusterId, 'batch.cronjob');
  }
}

export class WorkloadsCronJobsDetailsPagePo extends WorkloadDetailsPageBasePo {
  constructor(
    page: Page,
    workloadId: string,
    clusterId = 'local',
    namespaceId = 'default',
    queryParams?: Record<string, string>,
  ) {
    super(page, workloadId, clusterId, 'batch.cronjob', namespaceId, queryParams);
  }
}
