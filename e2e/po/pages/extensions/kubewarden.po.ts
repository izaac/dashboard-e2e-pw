import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';

export default class KubewardenExtensionPo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/kubewarden`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, KubewardenExtensionPo.createPath(clusterId));
  }

  dashboardTitle(): Locator {
    return this.page.locator('h1').filter({ hasText: 'Kubewarden' });
  }

  installButton(): Locator {
    return this.page.locator('button').filter({ hasText: 'Install Kubewarden' });
  }
}
