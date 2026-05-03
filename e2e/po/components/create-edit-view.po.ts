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

  /** Form save button (by `data-testid="form-save"`) */
  formSave(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="form-save"]', this.self());
  }

  /** Footer primary button — used for Create / Save / Next page (same DOM element). */
  saveButtonPo(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '.cru-resource-footer .role-primary', this.self());
  }

  /** Alias for `saveButtonPo()` — kept for callers using create-flow semantics. */
  createButton(): AsyncButtonPo {
    return this.saveButtonPo();
  }

  /** Footer secondary button — Cancel. */
  cancelButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '.cru-resource-footer .role-secondary', this.self());
  }

  /** "Edit as YAML" toggle button. */
  editYamlButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="form-yaml"]', this.self());
  }

  /** RKE2 custom cluster — switch the create form to YAML view. */
  editClusterYamlButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="rke2-custom-create-yaml"]', this.self());
  }

  /** RKE2 custom cluster — Save while in YAML view. */
  saveClusterYamlButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="rke2-custom-create-yaml-save"]', this.self());
  }

  /** Click Save and wait for the `Save → Saved` button-state transition (orchestration). */
  async saveAndWait(): Promise<void> {
    await this.saveButtonPo().action('Save', 'Saved');
  }

  keyInput(index = 0): Locator {
    return this.page.getByTestId(`input-kv-item-key-${index}`).first();
  }

  tabResourceQuotas(): Locator {
    return this.page.getByTestId('tab-resource-quotas').or(this.page.locator('li#resource-quotas'));
  }

  btnAddResource(): Locator {
    return this.page.locator('button').filter({ hasText: 'Add Resource' }).first();
  }

  inputProjectLimit(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="projectrow-project-quota-input"]');
  }

  async selectResourceType(index: number): Promise<void> {
    const combo = this.page.locator('[data-testid="projectrow-type-input"]');

    await combo.click();
    await this.page.locator('.vs__dropdown-menu > li').nth(index).click();
  }

  yamlEditor(): Locator {
    return this.page.locator('.resource-yaml').getByTestId('yaml-editor-code-mirror');
  }

  /** Click Save and wait for a specific `method endpoint` API response (orchestration). */
  async saveAndWaitForRequests(method: string, endpoint: string): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes(endpoint) && resp.request().method() === method,
    );

    await this.saveButtonPo().click();
    await responsePromise;
  }
}
