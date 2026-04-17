import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';

export class RancherSetupConfigurePage extends PagePo {
  static url = '/auth/setup';

  constructor(page: Page) {
    super(page, RancherSetupConfigurePage.url);
  }

  async goTo(): Promise<void> {
    await super.goTo();
  }

  serverUrl(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="setup-server-url"] input, [data-testid="setup-server-url"]');
  }

  serverUrlLocalhostWarningBanner(): Locator {
    return this.page.locator('[data-testid="setup-serverurl-localhost-warning"]');
  }

  errorBannerContent(label: string): Locator {
    return this.page.locator('[data-testid="setup-error-banner"]').filter({ hasText: label });
  }

  termsAgreementCheckbox(): Locator {
    return this.page.getByTestId('setup-agreement');
  }

  async setTermsAgreement(): Promise<void> {
    await this.termsAgreementCheckbox().locator('label, input[type="checkbox"]').first().click();
  }

  async canSubmit(): Promise<boolean> {
    return !(await this.submitButton().isDisabled());
  }

  async submit(): Promise<void> {
    await this.submitButton().click();
  }

  private submitButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="setup-submit"]');
  }
}
