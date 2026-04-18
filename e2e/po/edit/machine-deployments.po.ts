import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';

export default class MachineDeploymentsCreateEditPo extends PagePo {
  private static createPath(clusterId: string, nsName?: string, machineSetName?: string) {
    const root = `/c/${clusterId}/manager/cluster.x-k8s.io.machinedeployment`;

    return nsName && machineSetName ? `${root}/${nsName}/${machineSetName}` : `${root}/create`;
  }

  constructor(page: Page, clusterId = '_', nsName?: string, machineSetName?: string) {
    super(page, MachineDeploymentsCreateEditPo.createPath(clusterId, nsName, machineSetName));
  }

  saveCreateForm(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }
}
