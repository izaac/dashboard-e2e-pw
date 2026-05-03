import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import RadioGroupInputPo from '@/e2e/po/components/radio-group-input.po';
import { STANDARD } from '@/support/timeouts';

export default abstract class RoleEditPo extends PagePo {
  private static createPath(clusterId: string, resource: string, roleId?: string) {
    const root = `/c/${clusterId}/auth/roles/${resource}`;

    return roleId ? `${root}/${roleId}?mode=edit` : `${root}/create`;
  }

  constructor(page: Page, clusterId = '_', resource: string, roleId?: string) {
    super(page, RoleEditPo.createPath(clusterId, resource, roleId));
  }

  name(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Name');
  }

  description(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Description');
  }

  selectCheckbox(label: string): CheckboxInputPo {
    return CheckboxInputPo.byLabel(this.page, this.self(), label);
  }

  saveCreateForm(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="form-save"]', this.self());
  }

  saveEditYamlForm(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="action-button-async-button"]', this.self());
  }

  async saveAndWaitForRequests(method: string, url: string): Promise<any> {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes(url) && resp.request().method() === method,
      { timeout: STANDARD },
    );

    await this.saveCreateForm().click();

    return responsePromise;
  }

  async selectVerbs(itemRow: number, optionIndex: number): Promise<void> {
    const selectVerb = new LabeledSelectPo(this.page, `[data-testid="grant-resources-verbs${itemRow}"]`, this.self());

    await selectVerb.dropdown().click();
    await selectVerb.optionByIndex(optionIndex).click();
  }

  async selectResourcesByLabelValue(itemRow: number, label: string): Promise<void> {
    const selectResources = new LabeledSelectPo(
      this.page,
      `[data-testid="grant-resources-resources${itemRow}"]`,
      this.self(),
    );

    await selectResources.dropdown().click();
    await selectResources.clickOptionWithLabel(label);
  }

  async selectCreatorDefaultRadioBtn(optionIndex: number): Promise<void> {
    const selectRadio = new RadioGroupInputPo(
      this.page,
      '[data-testid="roletemplate-creator-default-options"] div > .radio-container',
      this.self(),
    );

    await selectRadio.set(optionIndex);
  }

  async selectLockedRadioBtn(optionIndex: number): Promise<void> {
    const selectRadio = new RadioGroupInputPo(
      this.page,
      '[data-testid="roletemplate-locked-options"] div > .radio-container',
      this.self(),
    );

    await selectRadio.set(optionIndex);
  }
}
