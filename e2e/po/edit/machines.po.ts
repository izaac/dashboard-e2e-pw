import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';

export default class MachinesCreateEditPo extends PagePo {
  private static createPath(clusterId: string, nsName?: string, machineName?: string) {
    const root = `/c/${clusterId}/manager/cluster.x-k8s.io.machine`;

    return nsName && machineName ? `${root}/${nsName}/${machineName}` : `${root}/create`;
  }

  constructor(page: Page, clusterId = '_', nsName?: string, machineName?: string) {
    super(page, MachinesCreateEditPo.createPath(clusterId, nsName, machineName));
  }

  saveCreateForm(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }
}
