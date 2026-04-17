import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';

/**
 * Use this for pages with the `_c` notation that changes given cluster context.
 */
export default class RootClusterPage extends PagePo {
  constructor(page: Page, path: string, selector?: string) {
    super(page, path, selector);
  }

  async getClusterIdFromUrl(): Promise<string> {
    await expect(this.page).toHaveURL(/\/c\//);

    const url = this.page.url();
    const parts = url.split('/');
    const clusterKey = parts.findIndex((part) => part === 'c');

    if (clusterKey <= 0) {
      throw new Error('Cannot find /c/ part of url');
    }

    return parts[clusterKey + 1];
  }

  async updatePathWithCurrentCluster(): Promise<void> {
    const clusterId = await this.getClusterIdFromUrl();

    this.path = this.path.replace('_', clusterId);
  }

  async waitForPageWithClusterId(params?: string, fragment?: string): Promise<void> {
    await this.updatePathWithCurrentCluster();
    await super.waitForPage(params, fragment);
  }
}
