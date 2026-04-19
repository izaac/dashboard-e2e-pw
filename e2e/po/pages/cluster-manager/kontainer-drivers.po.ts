import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';

export default class KontainerDriversPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/manager/kontainerDriver`;
  }

  constructor(page: Page, clusterId = '_') {
    super(page, KontainerDriversPagePo.createPath(clusterId));
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="kontainer-driver-list"]');
  }

  async goToDriverListAndGetDriverDetails(driverName: string): Promise<{ id: string }> {
    const responsePromise = this.page.waitForResponse(
      (resp) =>
        resp.url().includes('/v3/kontainerDrivers/') && resp.request().method() === 'GET' && resp.status() === 200,
      { timeout: 10000 },
    );

    await this.goTo();
    const response = await responsePromise;
    const body = await response.json();

    return body.data.filter((c: any) => c.name === driverName)[0];
  }

  title(): Locator {
    return this.page.locator('.title > h1').filter({ hasText: 'Cluster Drivers' });
  }

  refreshKubMetadata(): Locator {
    return this.page.getByTestId('kontainer-driver-refresh').filter({ hasText: 'Refresh Kubernetes Metadata' });
  }

  async createDriver(): Promise<void> {
    // Rancher 2.13: "Add Cluster Driver" link in masthead actions
    await this.page
      .locator(
        'a[href*="kontainerDriver/create"], a:has-text("Add Cluster Driver"), button:has-text("Add Cluster Driver")',
      )
      .first()
      .click();
  }

  growlText(): Locator {
    return this.page.locator('.growl-text');
  }
}
