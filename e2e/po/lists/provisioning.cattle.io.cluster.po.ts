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

  version(clusterName: string): Locator {
    return this.resourceTable().sortableTable().rowWithName(clusterName).column(3);
  }

  provider(clusterName: string): Locator {
    return this.resourceTable().sortableTable().rowWithName(clusterName).column(4);
  }

  providerSubType(clusterName: string): Locator {
    return this.resourceTable().sortableTable().rowWithName(clusterName).column(4).locator('.text-muted');
  }

  machines(clusterName: string): Locator {
    return this.resourceTable().sortableTable().rowElementWithName(clusterName).locator('.col-machine-summary-graph');
  }
}
