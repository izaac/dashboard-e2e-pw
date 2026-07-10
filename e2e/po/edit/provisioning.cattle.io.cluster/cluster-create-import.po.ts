import type { Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import BasicsRke2 from '@/e2e/po/edit/provisioning.cattle.io.cluster/tabs/basics-tab-rke2.po';

/**
 * Common to the dashboard's import + create cluster pages.
 * Ported from upstream cypress/e2e/po/edit/provisioning.cattle.io.cluster/cluster-create-import.po.ts.
 */
export default abstract class ClusterManagerCreateImportPagePo extends PagePo {
  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  nameNsDescription(): NameNsDescriptionPo {
    return new NameNsDescriptionPo(this.page, ':scope', this.self());
  }

  async selectOptionForCloudCredentialWithLabel(label: string): Promise<void> {
    const cloudCredSelect = new LabeledSelectPo(
      this.page,
      '[data-testid="cluster-prov-select-credential"]',
      this.self(),
    );

    await cloudCredSelect.dropdown().click();
    await cloudCredSelect.optionByLabel(label).click();
  }

  async selectTab(options: TabbedPo, selector: string): Promise<this> {
    await options.tabBySelector(selector).click();

    return this;
  }

  async create(): Promise<void> {
    await this.resourceDetail().createEditView().createButton().click();
  }

  async save(): Promise<void> {
    await this.resourceDetail().createEditView().saveButtonPo().click();
  }

  basicsTab(): BasicsRke2 {
    return new BasicsRke2(this.page);
  }

  accordion(index: number, label: string): Locator {
    return this.self().locator(`.accordion-container:nth-of-type(${index})`).filter({ hasText: label });
  }

  async toggleAccordion(index: number, label: string): Promise<void> {
    await this.accordion(index, label).click();
  }

  accordionHeaders(): Locator {
    return this.self().getByTestId('accordion-header');
  }

  tocListItems(): Locator {
    return this.self().locator('[data-testid^="toc-list-item-"]');
  }

  tocListItemButton(index: number): Locator {
    return this.self().getByTestId(`toc-list-item-${index}`).locator('button');
  }

  scrollContainer(): Locator {
    return this.page.locator('.main-layout');
  }

  scrollTop(): Promise<number> {
    return this.scrollContainer().evaluate((el) => el.scrollTop);
  }
}
