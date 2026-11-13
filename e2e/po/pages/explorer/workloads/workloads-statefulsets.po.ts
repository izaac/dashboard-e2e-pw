import type { Page } from '@playwright/test';
import { WorkloadsListPageBasePo, WorkloadDetailsPageBasePo } from '@/e2e/po/pages/explorer/workloads/workloads.po';
import RedeployDialogPo from '@/e2e/po/components/workloads/redeploy-dialog.po';

type WorkloadType = 'apps.statefulset';

export class WorkloadsStatefulSetsListPagePo extends WorkloadsListPageBasePo {
  constructor(page: Page, clusterId = 'local', queryParams?: Record<string, string>) {
    super(page, clusterId, 'apps.statefulset' as WorkloadType, queryParams);
  }

  /** Navigate to a statefulset detail page by name */
  async goToDetailsPage(workloadName: string): Promise<void> {
    await this.listElementWithName(workloadName).click();
  }

  redeployDialog(): RedeployDialogPo {
    return new RedeployDialogPo(this.page);
  }
}

export class WorkloadsStatefulSetsDetailsPagePo extends WorkloadDetailsPageBasePo {
  constructor(
    page: Page,
    workloadId: string,
    clusterId = 'local',
    namespaceId = 'default',
    queryParams?: Record<string, string>,
  ) {
    super(page, workloadId, clusterId, 'apps.statefulset' as WorkloadType, namespaceId, queryParams);
  }
}
