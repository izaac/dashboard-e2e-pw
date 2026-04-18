import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import CodeMirrorPo from '@/e2e/po/components/code-mirror.po';
import MachineDeploymentsCreateEditPo from '@/e2e/po/edit/machine-deployments.po';

export default class MachineDeploymentsPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/manager/cluster.x-k8s.io.machinedeployment`;
  }

  private clusterId: string;

  constructor(page: Page, clusterId = '_') {
    super(page, MachineDeploymentsPagePo.createPath(clusterId));
    this.clusterId = clusterId;
  }

  async create(): Promise<void> {
    await this.list().masthead().actions().filter({ hasText: 'Create from YAML' }).click();
  }

  createEditMachineDeployment(nsName?: string, machineSetName?: string): MachineDeploymentsCreateEditPo {
    return new MachineDeploymentsCreateEditPo(this.page, this.clusterId, nsName, machineSetName);
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="sortable-table-list-container"]');
  }

  yamlEditor(): CodeMirrorPo {
    return CodeMirrorPo.bySelector(this.page, this.self(), '[data-testid="yaml-editor-code-mirror"]');
  }
}
