import type { Page } from '@playwright/test';
import {
  WorkloadsListPageBasePo,
  WorkloadsCreatePageBasePo,
  WorkloadDetailsPageBasePo,
} from '@/e2e/po/pages/explorer/workloads/workloads.po';
import PagePo from '@/e2e/po/pages/page.po';
import CronScheduleHintPo from '@/e2e/po/components/cron-schedule-hint.po';

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

export class WorkloadsCronJobsCreatePagePo extends WorkloadsCreatePageBasePo {
  constructor(page: Page, clusterId = 'local') {
    super(page, clusterId, 'batch.cronjob');
  }

  schedule(): CronScheduleHintPo {
    return CronScheduleHintPo.forWorkload(this.page);
  }
}

export class WorkloadsCronJobsEditPagePo extends PagePo {
  constructor(page: Page, cronJobId: string, clusterId = 'local', namespaceId = 'default') {
    super(page, `/c/${clusterId}/explorer/batch.cronjob/${namespaceId}/${cronJobId}`);
  }

  async goToEdit(): Promise<void> {
    await this.goTo('mode=edit');
  }

  schedule(): CronScheduleHintPo {
    return CronScheduleHintPo.forWorkload(this.page);
  }
}
