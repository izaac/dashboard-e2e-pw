import type { Page, Locator } from '@playwright/test';
import ClusterManagerCreatePagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create.po';
import MachinePoolRke2 from '@/e2e/po/edit/provisioning.cattle.io.cluster/tabs/machine-pools-tab-rke2.po';
import BasicsRke2 from '@/e2e/po/edit/provisioning.cattle.io.cluster/tabs/basics-tab-rke2.po';
import NetworkRke2 from '@/e2e/po/edit/provisioning.cattle.io.cluster/tabs/networking-tab-rke2.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import CloudCredentialsCreateEditPo from '@/e2e/po/edit/cloud-credentials-amazon.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';

export default class ClusterManagerCreateRke2AmazonPagePo extends ClusterManagerCreatePagePo {
  constructor(page: Page, clusterId = '_') {
    super(page, clusterId);
  }

  cloudCredentialsForm(): CloudCredentialsCreateEditPo {
    return new CloudCredentialsCreateEditPo(this.page);
  }

  clusterConfigurationTabs(): TabbedPo {
    return new TabbedPo(this.page, '[data-testid="tabbed"]');
  }

  machinePoolTab(): MachinePoolRke2 {
    return new MachinePoolRke2(this.page);
  }

  basicsTab(): BasicsRke2 {
    return new BasicsRke2(this.page);
  }

  networkTab(): NetworkRke2 {
    return new NetworkRke2(this.page);
  }

  nameNsDescription(): NameNsDescriptionPo {
    return new NameNsDescriptionPo(this.page, ':scope', this.self());
  }

  ipv6ConfirmationDialog(): Locator {
    return this.page.locator('[data-testid="ipv6-dialog"]');
  }

  ipv6Recommendations(): Locator {
    return this.page.locator('[data-testid="ipv6-dialog-reasons"] li');
  }

  async create(): Promise<void> {
    await this.resourceDetail().createEditView().create();
  }

  async save(): Promise<Locator> {
    return this.resourceDetail().createEditView().save();
  }
}
