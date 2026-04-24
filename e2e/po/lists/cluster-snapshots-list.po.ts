import type { Page, Locator } from '@playwright/test';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';

export default class ClusterSnapshotsListPo extends BaseResourceList {
  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  details(name: string, index: number): Locator {
    return this.resourceTable().sortableTable().rowWithPartialName(name).column(index);
  }

  async checkTableIsEmpty(): Promise<void> {
    await this.resourceTable().sortableTable().noRowsText().waitFor({ state: 'visible' });
  }

  async clickOnSnapshotNow(): Promise<void> {
    await this.resourceTable().snapshotNowButton().click();
  }

  checkSnapshotExist(name: string): Locator {
    return this.resourceTable().sortableTable().rowWithPartialName(name).self();
  }
}
