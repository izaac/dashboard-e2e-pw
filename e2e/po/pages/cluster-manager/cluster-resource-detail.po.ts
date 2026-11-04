import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';

/**
 * Page object for a provisioning.cattle.io.cluster resource page in Cluster Management
 * (detail, config view and edit modes are selected through query params).
 */
export default class ClusterResourceDetailPagePo extends PagePo {
  private static createPath(clusterId: string, namespace: string) {
    return `/c/_/manager/provisioning.cattle.io.cluster/${ namespace }/${ clusterId }`;
  }

  constructor(page: Page, clusterId = 'local', namespace = 'fleet-local') {
    super(page, ClusterResourceDetailPagePo.createPath(clusterId, namespace));
  }

  /** Main content outlet that wraps the routed page (carries the page padding) */
  outlet(): Locator {
    return this.page.locator('.outlet').first();
  }

  /** Main layout container of the current page */
  mainLayout(): Locator {
    return this.page.locator('.main-layout').first();
  }
}
