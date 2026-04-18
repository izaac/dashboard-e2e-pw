import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import RegistryConfigsPo from '@/e2e/po/components/registry-configs.po';
import SelectOrCreateAuthPo from '@/e2e/po/components/select-or-create-auth.po';

export default class RegistriesTabPo extends ComponentPo {
  constructor(page: Page, selector = '.dashboard-root') {
    super(page, selector);
  }

  enableRegistryCheckbox(): CheckboxInputPo {
    return new CheckboxInputPo(this.page, '[data-testid="registries-enable-checkbox"]');
  }

  showAdvanced(): Locator {
    return this.self().locator('[data-testid="registries-advanced-section"] a');
  }

  async clickShowAdvanced(): Promise<void> {
    await this.showAdvanced().click();
  }

  advancedToggle(): Locator {
    return this.self().locator('[data-testid="registries-advanced-section"]');
  }

  registryHostInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="registry-host-input"]');
  }

  async addRegistryHost(host: string): Promise<void> {
    await this.registryHostInput().set(host);
  }

  registryConfigs(): RegistryConfigsPo {
    return new RegistryConfigsPo(this.page, ':scope', this.self());
  }

  registryAuthSelector(): SelectOrCreateAuthPo {
    return new SelectOrCreateAuthPo(this.page, '.select-or-create-auth-secret');
  }
}
