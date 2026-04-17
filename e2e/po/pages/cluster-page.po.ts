import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';

/**
 * Base page object for cluster-scoped pages.
 * Replaces the Cypress ClusterPage abstract class.
 */
export default class ClusterPagePo extends PagePo {
  private static createPath(clusterId: string, pathAfterCluster: string) {
    return `/c/${clusterId}/${pathAfterCluster}`;
  }

  constructor(page: Page, clusterId = '_', pathAfterCluster = '') {
    super(page, ClusterPagePo.createPath(clusterId, pathAfterCluster));
  }
}
