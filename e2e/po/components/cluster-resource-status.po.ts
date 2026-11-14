import type { Page } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import StatusSummaryCardPo from '@/e2e/po/components/status-summary-card.po';
import StatusBreakdownCardPo from '@/e2e/po/components/status-breakdown-card.po';

/**
 * The resource status card group on the Cluster Dashboard: Nodes and Deployments summary cards plus the
 * "Other, Unhealthy Workloads" breakdown card.
 */
export default class ClusterResourceStatusPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '[data-testid="cluster-dashboard-resource-status"]');
  }

  nodesCard(): StatusSummaryCardPo {
    return new StatusSummaryCardPo(this.page, 'Nodes', this.self());
  }

  deploymentsCard(): StatusSummaryCardPo {
    return new StatusSummaryCardPo(this.page, 'Deployments', this.self());
  }

  unhealthyWorkloadsCard(): StatusBreakdownCardPo {
    return new StatusBreakdownCardPo(this.page, this.self());
  }

  async pressTab(): Promise<void> {
    await this.page.keyboard.press('Tab');
  }

  async pressEnter(): Promise<void> {
    await this.page.keyboard.press('Enter');
  }
}
