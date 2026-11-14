import type { Page, Locator } from '@playwright/test';
import ClusterManagerCreatePagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';
import RadioGroupInputPo from '@/e2e/po/components/radio-group-input.po';
import RcSectionPo from '@/e2e/po/components/rc-section.po';

/**
 * "Create Cluster API Provider AWS" form, contributed by the CAPA UI extension
 * (rancher/prov-capi-ui-extensions, package `capa`).
 */
export default class ClusterManagerCreateCapaAwsPagePo extends ClusterManagerCreatePagePo {
  static readonly query = 'type=awsmachinetemplate&rkeType=rke2';

  constructor(page: Page, clusterId = 'local') {
    super(page, clusterId);
  }

  async goToForm(): Promise<void> {
    await this.goTo(ClusterManagerCreateCapaAwsPagePo.query);
  }

  async waitForForm(): Promise<void> {
    await this.waitForPage(ClusterManagerCreateCapaAwsPagePo.query);
    await this.capiClusterConfigurationSection().self().waitFor();
  }

  cloudCredential(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="cluster-prov-select-credential"]');
  }

  nameNsDescription(): NameNsDescriptionPo {
    return new NameNsDescriptionPo(this.page, ':scope', this.self());
  }

  /** Labeled select located by its label text (substring: the required marker "*" lives in a nested span) */
  private labeledSelect(label: string): LabeledSelectPo {
    return new LabeledSelectPo(this.page, `.labeled-select:has(label:has-text("${label}"))`, this.self());
  }

  regionSelect(): LabeledSelectPo {
    return this.labeledSelect('Region');
  }

  iamInstanceProfileSelect(): LabeledSelectPo {
    return this.labeledSelect('IAM Instance Profile Name');
  }

  vpcSelect(): LabeledSelectPo {
    return this.labeledSelect('VPC');
  }

  subnetsSelect(): LabeledSelectPo {
    return this.labeledSelect('Subnets');
  }

  networkStrategy(): RadioGroupInputPo {
    return new RadioGroupInputPo(this.page, '[role="radiogroup"][aria-label="Strategy"]', this.self());
  }

  managedNetworkOption(): Locator {
    return this.networkStrategy().radioSpanByLabel('Managed network');
  }

  unmanagedNetworkOption(): Locator {
    return this.networkStrategy().radioSpanByLabel('Unmanaged network');
  }

  capiClusterConfigurationSection(): RcSectionPo {
    return new RcSectionPo(this.page, 'CAPI Cluster Configuration', this.self());
  }

  networkConfigurationSection(): RcSectionPo {
    return new RcSectionPo(this.page, 'Network configuration', this.self());
  }

  /** Tooltip bubble currently shown (rendered outside the section, at the end of the body) */
  shownTooltip(): Locator {
    return this.page.locator('.v-popper__popper--shown');
  }

  createButton(): Locator {
    return this.page.getByTestId('rke2-custom-create-save');
  }

  async selectCloudCredential(name: string): Promise<void> {
    await this.cloudCredential().dropdown().click();
    await this.cloudCredential().clickOptionWithLabel(name);
  }

  /** The IAM instance profile select is taggable, so a name can be typed and committed with Enter */
  async setInstanceProfile(name: string): Promise<void> {
    const select = this.iamInstanceProfileSelect();

    await select.self().click();
    await select.searchInput().fill(name);
    await select.searchInput().press('Enter');
  }

  async selectManagedNetwork(): Promise<void> {
    await this.networkStrategy().getAllOptions().filter({ hasText: 'Managed network' }).first().click();
  }

  async selectUnmanagedNetwork(): Promise<void> {
    await this.networkStrategy().getAllOptions().filter({ hasText: 'Unmanaged network' }).click();
  }

  async selectFirstVpc(): Promise<void> {
    await this.vpcSelect().dropdown().click();
    await this.vpcSelect().optionByIndex(1).click();
  }

  async selectFirstSubnet(): Promise<void> {
    await this.subnetsSelect().dropdown().click();
    await this.subnetsSelect().optionByIndex(1).click();
    await this.page.keyboard.press('Escape');
  }
}
