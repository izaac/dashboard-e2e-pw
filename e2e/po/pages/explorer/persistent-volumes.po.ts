import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import type { Locator } from '@playwright/test';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import ResourceTablePo from '@/e2e/po/components/resource-table.po';

export class PersistentVolumesPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/persistentvolume`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, PersistentVolumesPagePo.createPath(clusterId));
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '.dashboard-root');
  }

  /** The Claim column also links to a detail page, so pick the link by the volume's own name. */
  async goToDetailsPage(name: string): Promise<void> {
    await this.list()
      .resourceTable()
      .sortableTable()
      .rowWithName(name)
      .self()
      .getByRole('link', { name, exact: true })
      .click();
  }
}

export type PersistentVolumeMastheadDetail =
  | 'source'
  | 'capacity'
  | 'reclaim-policy'
  | 'storage-class'
  | 'access-modes';

export class PersistentVolumeDetailPagePo extends PagePo {
  private static createPath(clusterId: string, name: string) {
    return `/c/${clusterId}/explorer/persistentvolume/${name}`;
  }

  constructor(page: Page, name: string, clusterId = 'local') {
    super(page, PersistentVolumeDetailPagePo.createPath(clusterId, name));
  }

  private tabs(): TabbedPo {
    return new TabbedPo(this.page);
  }

  mastheadDetail(name: PersistentVolumeMastheadDetail): Locator {
    return this.page.getByTestId(`pv-detail-${name}`);
  }

  async clickClaimsTab(): Promise<void> {
    await this.tabs().tab('volume-claim').click();
  }

  claimsTabPanel(): Locator {
    return this.tabs().panel('volume-claim');
  }

  claimsList(): ResourceTablePo {
    return this.tabs().tabbedList('volume-claim');
  }

  claimsEmptyCaption(): Locator {
    return this.claimsTabPanel().locator('p.caption');
  }
}
