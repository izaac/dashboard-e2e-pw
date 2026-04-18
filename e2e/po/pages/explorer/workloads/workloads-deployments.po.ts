import type { Page, Locator } from '@playwright/test';
import {
  WorkloadsListPageBasePo,
  WorkloadsCreatePageBasePo,
  WorkloadDetailsPageBasePo,
} from '@/e2e/po/pages/explorer/workloads/workloads.po';

type WorkloadType = 'apps.deployment';

export class WorkloadsDeploymentsListPagePo extends WorkloadsListPageBasePo {
  constructor(page: Page, clusterId = 'local', queryParams?: Record<string, string>) {
    super(page, clusterId, 'apps.deployment' as WorkloadType, queryParams);
  }

  /** Navigate to a deployment detail page by name */
  async goToDetailsPage(workloadName: string): Promise<void> {
    await this.listElementWithName(workloadName).click();
  }

  /**
   * Create a resource via kubectl.
   * In Playwright tests, prefer using the rancherApi fixture directly.
   */
  async createWithKubectl(_blueprint: any): Promise<void> {
    // Placeholder - use rancherApi fixture in actual tests
  }

  /** Delete a resource via kubectl */
  async deleteWithKubectl(_name: string, _namespace: string): Promise<void> {
    // Placeholder - use rancherApi fixture in actual tests
  }

  redeployDialog(): Locator {
    return this.page.getByTestId('redeploy-dialog').or(this.page.locator('.prompt-modal'));
  }
}

export class WorkloadsDeploymentsCreatePagePo extends WorkloadsCreatePageBasePo {
  constructor(page: Page, clusterId = 'local', queryParams?: Record<string, string>) {
    super(page, clusterId, 'apps.deployment' as WorkloadType, queryParams);
  }
}

export class WorkloadsDeploymentsDetailsPagePo extends WorkloadDetailsPageBasePo {
  constructor(
    page: Page,
    workloadId: string,
    clusterId = 'local',
    namespaceId = 'default',
    queryParams?: Record<string, string>,
  ) {
    super(page, workloadId, clusterId, 'apps.deployment' as WorkloadType, namespaceId, queryParams);
  }
}
