import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
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
    expect(await this.canSubmit()).toBe(true);
    await this.password().set(bootstrapPassword);
    expect(await this.canSubmit()).toBe(true);
    await this.submit();
  }

  async hasInfoMessage(): Promise<void> {
    await expect(this.page.getByTestId('first-login-message')).toBeVisible();
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
