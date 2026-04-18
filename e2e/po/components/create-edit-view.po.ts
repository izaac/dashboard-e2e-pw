import type { Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';

export default class CreateEditViewPo extends ComponentPo {
  nameNsDescription(): NameNsDescriptionPo {
    return new NameNsDescriptionPo(this.page, ':scope', this.self());
  }

  errorBanner(): Locator {
    return this.self().locator('#cru-errors');
  }

  /** Form save button (by data-testid) */
  formSave(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="form-save"]', this.self());
  }

  createButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '.cru-resource-footer .role-primary', this.self());
  }

  async create(): Promise<void> {
    await this.createButton().click();
  }

  async save(): Promise<void> {
    await new AsyncButtonPo(this.page, '.cru-resource-footer .role-primary', this.self()).click();
  }

  async cancel(): Promise<void> {
    await new AsyncButtonPo(this.page, '.cru-resource-footer .role-secondary', this.self()).click();
  }

  async saveAndWait(): Promise<void> {
    await new AsyncButtonPo(this.page, '.cru-resource-footer .role-primary', this.self()).action('Save', 'Saved');
  }

  async nextPage(): Promise<void> {
    await new AsyncButtonPo(this.page, '.cru-resource-footer .role-primary', this.self()).click();
  }

  saveButtonPo(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '.cru-resource-footer .role-primary', this.self());
  }

  async editAsYaml(): Promise<void> {
    await new AsyncButtonPo(this.page, '[data-testid="form-yaml"]', this.self()).click();
  }

  async editClusterAsYaml(): Promise<void> {
    await new AsyncButtonPo(this.page, '[data-testid="rke2-custom-create-yaml"]', this.self()).click();
  }

  async saveClusterAsYaml(): Promise<void> {
    await new AsyncButtonPo(this.page, '[data-testid="rke2-custom-create-yaml-save"]', this.self()).click();
  }

  keyInput(index = 0): Locator {
    return this.page.getByTestId(`input-kv-item-key-${index}`).first();
  }

  tabResourceQuotas(): Locator {
    return this.page.getByTestId('tab-resource-quotas').or(this.page.locator('#resource-quotas'));
  }

  btnAddResource(): Locator {
    return this.page.locator('button').filter({ hasText: 'Add Resource' }).first();
  }

  inputProjectLimit(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="projectrow-project-quota-input"]');
  }

  yamlEditor(): Locator {
    return this.page.locator('.resource-yaml .CodeMirror, .resource-yaml .code-mirror');
  }

  async saveAndWaitForRequests(method: string, endpoint: string): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes(endpoint) && resp.request().method() === method,
    );

    await this.save();
    await responsePromise;
  }
}
