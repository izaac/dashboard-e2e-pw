import type { Page, Locator } from '@playwright/test';
import ClusterManagerCreatePagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import RegistriesTabPo from '@/e2e/po/components/registries-tab.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';

export default class ClusterManagerCreateRke2CustomPagePo extends ClusterManagerCreatePagePo {
  static url(clusterId: string): string {
    return `${ClusterManagerCreatePagePo.url(clusterId)}/create?type=custom#basic`;
  }

  constructor(page: Page, clusterId = '_') {
    super(page, clusterId, 'type=custom#basic');
  }

  async goToCustomClusterCreation(clusterId: string): Promise<void> {
    const path = `.${ClusterManagerCreatePagePo.url(clusterId)}?type=custom#basic`;

    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
  }

  async goToDigitalOceanCreation(clusterId: string): Promise<void> {
    const path = `.${ClusterManagerCreatePagePo.url(clusterId)}?type=digitalocean#basic`;

    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
  }

  title(): Locator {
    return this.self().locator('.title-bar h1.title, .primaryheader h1');
  }

  clusterConfigurationTabs(): TabbedPo {
    return new TabbedPo(this.page);
  }

  registries(): RegistriesTabPo {
    return new RegistriesTabPo(this.page);
  }

  nameNsDescription(): NameNsDescriptionPo {
    return new NameNsDescriptionPo(this.page, ':scope', this.self());
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  cniSelect(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="cluster-rke2-cni-select"]');
  }

  ciliumBandwidthManagerCheckbox(): CheckboxInputPo {
    return new CheckboxInputPo(this.page, '[data-testid="cluster-rke2-cni-cilium-bandwidth-manager-checkbox"]');
  }

  async create(): Promise<void> {
    await this.resourceDetail().createEditView().create();
  }
}
