import type { Page, Locator } from '@playwright/test';
import ClusterManagerCreateImportPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/cluster-create-import.po';

/**
 * Core functionality of the dashboard's import cluster pages.
 * Ported from upstream cypress/e2e/po/edit/provisioning.cattle.io.cluster/import/cluster-import.po.ts.
 */
export default class ClusterManagerImportPagePo extends ClusterManagerCreateImportPagePo {
  private static createPath(clusterId: string): string {
    return `/c/${clusterId}/manager/provisioning.cattle.io.cluster/create`;
  }

  constructor(page: Page, clusterId = '_') {
    super(page, ClusterManagerImportPagePo.createPath(clusterId));
  }

  selectKubeProvider(index: number): Locator {
    return this.resourceDetail().cruResource().selectSubType(0, index);
  }

  selectGeneric(index: number): Locator {
    return this.resourceDetail().cruResource().selectSubType(1, index);
  }
}
