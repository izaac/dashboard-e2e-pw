import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import PasswordPo from '@/e2e/po/components/password.po';

export class RancherSetupLoginPagePo extends PagePo {
  static url = '/auth/login';

  constructor(page: Page) {
    super(page, RancherSetupLoginPagePo.url);
  }

  async goTo(): Promise<void> {
    await super.goTo();
  }

  form(): Locator {
    return this.self().locator('form');
  }

  async bootstrapLogin(bootstrapPassword: string): Promise<void> {
    await this.password().set(bootstrapPassword);
    // click() auto-waits for the button to be visible and enabled
    await this.submit();
  }

  /** Get the info message locator */
  infoMessage(): Locator {
    return this.page.getByTestId('first-login-message');
  }

  password(): PasswordPo {
    return new PasswordPo(this.page, '[data-testid="local-login-password"]');
  }

  async canSubmit(): Promise<boolean> {
    return !(await this.submitButton().isDisabled());
  }

  async submit(): Promise<void> {
    await this.submitButton().click();
  }

  private submitButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="login-submit"]');
  }
}
