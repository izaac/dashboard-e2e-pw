import ClusterManagerDetailPagePo from '@/e2e/po/detail/provisioning.cattle.io.cluster/cluster-detail.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import ResourceTablePo from '@/e2e/po/components/resource-table.po';
import TooltipPo from '@/e2e/po/components/tooltip.po';

/**
 * Detail page for built-in hosted clusters (AKS, EKS, GKE) and imported clusters.
 * Ported from upstream cypress/e2e/po/detail/provisioning.cattle.io.cluster/cluster-detail-hosted.po.ts.
 */
export default class ClusterManagerDetailHostedPagePo extends ClusterManagerDetailPagePo {
  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  nodePoolTable(): ResourceTablePo {
    return new ResourceTablePo(this.page, '[data-testid="mgmt-node-table"]', this.self());
  }

  groupByPoolToolTip(): TooltipPo {
    return new TooltipPo(this.page, this.nodePoolTable().sortableTable().groupByButtons(1));
  }

  flatListToolTip(): TooltipPo {
    return new TooltipPo(this.page, this.nodePoolTable().sortableTable().groupByButtons(0));
  }
}
