import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import RadioGroupInputPo from '@/e2e/po/components/radio-group-input.po';
import PasswordPo from '@/e2e/po/components/password.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';

export class RancherSetupConfigurePage extends PagePo {
  static url = '/auth/setup';

  constructor(page: Page) {
    super(page, RancherSetupConfigurePage.url);
  }

  async goTo(): Promise<void> {
    await super.goTo();
  }

  choosePassword(): RadioGroupInputPo {
    return new RadioGroupInputPo(this.page, '[data-testid="setup-password-mode"]');
  }

  password(): PasswordPo {
    return new PasswordPo(this.page, '[data-testid="setup-password"]');
  }

  confirmPassword(): PasswordPo {
    return new PasswordPo(this.page, '[data-testid="setup-password-confirm"]');
  }

  termsAgreement(): CheckboxInputPo {
    return new CheckboxInputPo(this.page, '[data-testid="setup-agreement"]');
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
