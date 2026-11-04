import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';

/**
 * Page object for a provisioning.cattle.io.cluster resource page in Cluster Management
 * (detail, config view and edit modes are selected through query params).
 */
export default class ClusterResourceDetailPagePo extends PagePo {
  private static createPath(clusterId: string, namespace: string) {
    return `/c/_/manager/provisioning.cattle.io.cluster/${namespace}/${clusterId}`;
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

  /** Loading overlays rendered while the routed page fetches its data */
  loadingIndicators(): Locator {
    return this.page.locator('.loading, .data-loading, div:text-is("Loading...")');
  }

  /**
   * Deterministic settle point for assertions and screenshot capture.
   *
   * Replaces a `networkidle` wait: Rancher keeps long-lived websockets open, so
   * network quiescence is neither guaranteed nor meaningful on these pages.
   * Watching the routed page's loading overlays detach and the document finish
   * its asset loads tracks real UI state instead of network silence.
   */
  async waitForContentSettled(timeout = 30000): Promise<void> {
    await this.outlet().waitFor({ state: 'visible', timeout });
    await this.loadingIndicators().first().waitFor({ state: 'detached', timeout });
    await this.page.waitForFunction(() => document.readyState === 'complete', undefined, { timeout });
  }
}
