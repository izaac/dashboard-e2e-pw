import type { Page } from '@playwright/test';
import ClusterManagerCreateImportPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/cluster-create-import.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import AddonConfigPo from '@/e2e/po/components/addon-config.po';

/**
 * Edit page for an RKE2 custom cluster.
 * Ported from upstream cypress/e2e/po/edit/provisioning.cattle.io.cluster/edit/cluster-edit-rke2-custom.po.ts.
 */
export default class ClusterManagerEditRke2CustomPagePo extends ClusterManagerCreateImportPagePo {
  private static createPath(clusterId: string, clusterName: string): string {
    return `/c/${clusterId}/manager/provisioning.cattle.io.cluster/fleet-default/${clusterName}`;
  }

  constructor(page: Page, clusterId = '_', clusterName: string) {
    super(page, ClusterManagerEditRke2CustomPagePo.createPath(clusterId, clusterName));
  }

  clusterConfigurationTabs(): TabbedPo {
    return new TabbedPo(this.page);
  }

  calicoAddonConfig(): AddonConfigPo {
    return new AddonConfigPo(this.page);
  }
}
