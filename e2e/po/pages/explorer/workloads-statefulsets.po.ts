import type { Page, Locator } from '@playwright/test';
import { WorkloadsListPageBasePo } from '@/e2e/po/pages/explorer/workloads/workloads.po';

type WorkloadType = 'apps.statefulset';

export class WorkloadsStatefulSetsListPagePo extends WorkloadsListPageBasePo {
  constructor(page: Page, clusterId = 'local', queryParams?: Record<string, string>) {
    super(page, clusterId, 'apps.statefulset' as WorkloadType, queryParams);
  }

  redeployDialog(): Locator {
    return this.page.locator('#modal-container-element');
  }
}
