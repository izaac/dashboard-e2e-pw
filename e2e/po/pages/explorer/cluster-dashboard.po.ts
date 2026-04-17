import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';

/**
 * Page object for the Cluster Dashboard / Explorer landing page.
 */
export default class ClusterDashboardPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer`;
  }

  constructor(page: Page, clusterId: string) {
    super(page, ClusterDashboardPagePo.createPath(clusterId));
  }

  customizeAppearanceButton(): Locator {
    return this.page.getByTestId('add-custom-cluster-badge');
  }
}
