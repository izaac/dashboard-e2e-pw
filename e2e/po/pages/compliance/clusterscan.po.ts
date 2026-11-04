import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import ListRowPo from '@/e2e/po/components/list-row.po';
import ResourceTablePo from '@/e2e/po/components/resource-table.po';

/**
 * ClusterScan list and create form (`/c/<cluster>/compliance/compliance.cattle.io.clusterscan`).
 * Scans have no name field: the API generates a `scan-xxxxx` name, and the
 * defaults (k3s-cis-2.0-profile, warn results pass, run once) are submitted as-is.
 */
export default class ClusterScanPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/compliance/compliance.cattle.io.clusterscan`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, ClusterScanPagePo.createPath(clusterId));
  }

  createButton(): Locator {
    return this.page.getByTestId('masthead-create');
  }

  async goToCreate(): Promise<void> {
    await this.createButton().click();
  }

  passRadio(): Locator {
    return this.page.getByTestId('Pass');
  }

  runOnceRadio(): Locator {
    return this.page.getByTestId('Run scan once');
  }

  submitButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="form-save"]');
  }

  async submitCreate(): Promise<void> {
    await this.submitButton().click();
  }

  table(): ResourceTablePo {
    return new ResourceTablePo(this.page, '.dashboard-root');
  }

  row(name: string): ListRowPo {
    return this.table().sortableTable().rowWithName(name);
  }

  /** State is the first data column (index 0 is the selection checkbox). */
  rowState(name: string): Locator {
    return this.row(name).column(1);
  }
}
