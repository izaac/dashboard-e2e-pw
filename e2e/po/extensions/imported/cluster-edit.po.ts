import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ACE from '@/e2e/po/components/ace.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import RadioGroupInputPo from '@/e2e/po/components/radio-group-input.po';

/**
 * Edit page for an imported cluster.
 * Ported from upstream cypress/e2e/po/extensions/imported/cluster-edit.po.ts.
 */
export default class ClusterManagerEditImportedPagePo extends PagePo {
  private static createPath(clusterId: string, ns: string, clusterName: string): string {
    return `/c/${clusterId}/manager/provisioning.cattle.io.cluster/${ns}/${clusterName}`;
  }

  constructor(page: Page, clusterId = '_', ns = 'fleet-default', clusterName: string) {
    super(page, ClusterManagerEditImportedPagePo.createPath(clusterId, ns, clusterName));
  }

  nameNsDescription(): NameNsDescriptionPo {
    return new NameNsDescriptionPo(this.page, ':scope', this.self());
  }

  ace(): ACE {
    return new ACE(this.page);
  }

  /** Accordion at 1-based DOM index whose header contains `label`. */
  accordion(index: number, label: string): Locator {
    return this.self().locator(`.accordion-container:nth-of-type(${index})`).filter({ hasText: label });
  }

  async toggleAccordion(index: number, label: string): Promise<void> {
    await this.accordion(index, label).click();
  }

  /** Accordion by visible label only — resilient when DOM order changes. */
  accordionByLabel(label: string): Locator {
    return this.self().locator('.accordion-container').filter({ hasText: label });
  }

  networkingAccordion(): Locator {
    // PW historically used `network-accordion` for the Edit-imported page; upstream
    // Edit PO does not define this method (callers use `accordion(5, 'Networking')`).
    return this.self().getByTestId('network-accordion');
  }

  registriesAccordion(): Locator {
    return this.self().getByTestId('registries-accordion');
  }

  versionManagementBanner(): Locator {
    return this.self().getByTestId('version-management-banner');
  }

  versionManagementRadioButton(): RadioGroupInputPo {
    return new RadioGroupInputPo(this.page, '[data-testid="imported-version-management-radio"]', this.self());
  }

  async enableVersionManagement(): Promise<void> {
    await this.versionManagementRadioButton().set(1);
  }

  async disableVersionManagement(): Promise<void> {
    await this.versionManagementRadioButton().set(2);
  }

  async defaultVersionManagement(): Promise<void> {
    await this.versionManagementRadioButton().set(0);
  }

  /** Raw ACE-enabled radio locator — kept for callers that pre-date the ACE PO. */
  aceEnabledRadio(): Locator {
    return this.self().getByTestId('ace-enabled-radio-input');
  }

  privateRegistryCheckbox(): CheckboxInputPo {
    return new CheckboxInputPo(this.page, '[data-testid="private-registry-enable-checkbox"]', this.self());
  }

  async enablePrivateRegistryCheckbox(): Promise<void> {
    await this.privateRegistryCheckbox().set();
  }

  privateRegistry(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Container Registry');
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  async save(): Promise<void> {
    await this.resourceDetail().createEditView().saveButtonPo().click();
  }

  async cancel(): Promise<void> {
    await this.resourceDetail().createEditView().cancelButton().click();
  }
}
