import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import RadioGroupInputPo from '@/e2e/po/components/radio-group-input.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';

export default class AzureadPo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/auth/config/azuread?mode=edit`;
  }

  constructor(page: Page, clusterId = '_') {
    super(page, AzureadPo.createPath(clusterId));
  }

  endpointsRadioBtn(): RadioGroupInputPo {
    return new RadioGroupInputPo(this.page, '[data-testid="endpoints-radio-input"]');
  }

  async selectEndpointsOption(index: number): Promise<void> {
    const radioButton = new RadioGroupInputPo(this.page, '[data-testid="endpoints-radio-input"]');

    await radioButton.set(index);
  }

  tenantIdInputField(): Locator {
    return this.self().locator('[data-testid="input-azureAD-tenantId"]');
  }

  async enterTenantId(name: string): Promise<void> {
    await new LabeledInputPo(this.page, '[data-testid="input-azureAD-tenantId"]').set(name);
  }

  applicationIdInputField(): Locator {
    return this.self().locator('[data-testid="input-azureAD-applcationId"]');
  }

  async enterApplicationId(name: string): Promise<void> {
    await new LabeledInputPo(this.page, '[data-testid="input-azureAD-applcationId"]').set(name);
  }

  applicationSecretInputField(): Locator {
    return this.self().locator('[data-testid="input-azureAD-applicationSecret"]');
  }

  async enterApplicationSecret(name: string): Promise<void> {
    await new LabeledInputPo(this.page, '[data-testid="input-azureAD-applicationSecret"]').set(name);
  }

  groupMembershipFilterCheckbox(): CheckboxInputPo {
    return new CheckboxInputPo(this.page, '[data-testid="checkbox-azureAD-groupMembershipFilter"]');
  }

  async enterGroupMembershipFilter(text: string): Promise<void> {
    await new LabeledInputPo(this.page, '[data-testid="input-azureAD-groupMembershipFilter"]').set(text);
  }

  endpointInputField(): Locator {
    return this.self().locator('[data-testid="input-azureAD-endpoint"]');
  }

  async enterEndpoint(name: string): Promise<void> {
    await new LabeledInputPo(this.page, '[data-testid="input-azureAD-endpoint"]').set(name);
  }

  graphEndpointInputField(): Locator {
    return this.self().locator('[data-testid="input-azureAD-graphEndpoint"]');
  }

  async enterGraphEndpoint(name: string): Promise<void> {
    await new LabeledInputPo(this.page, '[data-testid="input-azureAD-graphEndpoint"]').set(name);
  }

  tokenEndpointInputField(): Locator {
    return this.self().locator('[data-testid="input-azureAD-tokenEndpoint"]');
  }

  async enterTokenEndpoint(name: string): Promise<void> {
    await new LabeledInputPo(this.page, '[data-testid="input-azureAD-tokenEndpoint"]').set(name);
  }

  authEndpointInputField(): Locator {
    return this.self().locator('[data-testid="input-azureAD-authEndpoint"]');
  }

  async enterAuthEndpoint(name: string): Promise<void> {
    await new LabeledInputPo(this.page, '[data-testid="input-azureAD-authEndpoint"]').set(name);
  }

  saveButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="form-save"]', this.self());
  }

  async save(): Promise<void> {
    await new AsyncButtonPo(this.page, '[data-testid="form-save"]').click();
  }

  permissionsWarningBanner(): Locator {
    return this.self().locator('[data-testid="auth-provider-admin-permissions-warning-banner"]');
  }
}
