import type { Locator } from '@playwright/test';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';

export default class ProvClusterListPo extends BaseResourceList {
  explore(clusterName: string): Locator {
    return this.resourceTable()
      .sortableTable()
      .rowElementWithName(clusterName)
      .locator('[data-testid="cluster-manager-list-explore-management"]');
  }

  state(clusterName: string): Locator {
    return this.resourceTable().sortableTable().rowElementWithName(clusterName).locator('td').nth(1);
  }

  name(clusterName: string): Locator {
    return this.resourceTable().sortableTable().rowElementWithName(clusterName).locator('td').nth(2);
  }
}
