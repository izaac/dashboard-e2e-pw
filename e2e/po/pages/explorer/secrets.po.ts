import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import CruResourcePo from '@/e2e/po/components/cru-resource.po';
import CreateEditViewPo from '@/e2e/po/components/create-edit-view.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';

export class SecretsListPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/secret`;
  }

  constructor(page: Page, clusterId: string) {
    super(page, SecretsListPagePo.createPath(clusterId));
  }

  title(): Locator {
    return this.self().locator('.title h1');
  }

  createButton(): Locator {
    return this.self().locator('[data-testid="secrets-list-create"]');
  }

  createButtonTitle(): Locator {
    return this.createButton();
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="sortable-table-list-container"]');
  }

  /** List filter box: the new-UX query box, falling back to the legacy search row */
  filterInput(): Locator {
    return this.page
      .getByTestId('table-views-query')
      .or(this.page.getByTestId('search-box-filter-row').getByRole('textbox'))
      .first();
  }

  async filterByName(text: string): Promise<void> {
    const input = this.filterInput();

    await input.focus();
    await input.clear();
    await input.fill(text);
  }
}

export class SecretsCreateEditPo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/secret/create`;
  }

  constructor(page: Page, clusterId: string) {
    super(page, SecretsCreateEditPo.createPath(clusterId));
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  cruResource(): CruResourcePo {
    return new CruResourcePo(this.page, '[data-testid="cru-form"]');
  }

  selectSecretSubtype(subtype: string): Locator {
    return this.cruResource().findSubTypeByName(subtype);
  }

  createEditView(): CreateEditViewPo {
    return new CreateEditViewPo(this.page, ':scope', this.self());
  }

  nameNsDescription(): NameNsDescriptionPo {
    return this.createEditView().nameNsDescription();
  }

  async selectNamespace(label: string): Promise<void> {
    await this.nameNsDescription().namespace().dropdown().click();
    await this.nameNsDescription().namespace().clickOptionWithLabel(label);
  }

  /** Text input shown after choosing "Create a New Namespace" */
  createNamespaceInput(): LabeledInputPo {
    return new LabeledInputPo(
      this.page,
      '[data-testid="name-ns-description-namespace"] .create-input input',
      this.self(),
    );
  }

  saveOrCreate(): AsyncButtonPo {
    return this.createEditView().formSave();
  }

  tlsCertInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, 'textarea[name="tls.crt"]', this.self());
  }

  tlsKeyInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, 'textarea[name="tls.key"]', this.self());
  }

  sshPublicKeyInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="ssh-public-key"]', this.self());
  }

  sshPrivateKeyInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="ssh-private-key"]', this.self());
  }

  certReadFromFileButton(): Locator {
    return this.self().getByRole('button', { name: 'Read from File - Certificate' });
  }

  dataAddButton(): Locator {
    return this.self().getByTestId('add_row_item_button');
  }

  dataKeyInput(index = 0): LabeledInputPo {
    return new LabeledInputPo(this.page, `[data-testid="input-kv-item-key-${index}"]`, this.self());
  }

  dataValueInput(index = 0): Locator {
    return this.self().getByTestId(`kv-item-value-${index}`).locator('input, textarea').first();
  }
}
