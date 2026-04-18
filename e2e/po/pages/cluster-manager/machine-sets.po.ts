import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import CodeMirrorPo from '@/e2e/po/components/code-mirror.po';
import MachineSetsCreateEditPo from '@/e2e/po/edit/machine-sets.po';

export default class MachineSetsPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/manager/cluster.x-k8s.io.machineset`;
  }

  private clusterId: string;

  constructor(page: Page, clusterId = '_') {
    super(page, MachineSetsPagePo.createPath(clusterId));
    this.clusterId = clusterId;
  }

  async create(): Promise<void> {
    await this.list().masthead().actions().filter({ hasText: 'Create from YAML' }).click();
  }

  createEditMachineSet(nsName?: string, machineSetName?: string): MachineSetsCreateEditPo {
    return new MachineSetsCreateEditPo(this.page, this.clusterId, nsName, machineSetName);
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="sortable-table-list-container"]');
  }

  yamlEditor(): CodeMirrorPo {
    return CodeMirrorPo.bySelector(this.page, this.self(), '[data-testid="yaml-editor-code-mirror"]');
  }
}
