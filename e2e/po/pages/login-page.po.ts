import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import PasswordPo from '@/e2e/po/components/password.po';
import ComponentPo from '@/e2e/po/components/component.po';

export class LoginPagePo extends PagePo {
  static url = '/auth/login';

  constructor(page: Page) {
    super(page, LoginPagePo.url);
  }

  async goTo(): Promise<void> {
    await super.goTo();
  }

  username(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="local-login-username"] input, [data-testid="local-login-username"]');
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

  async switchToLocal(): Promise<void> {
    const useLocal = this.page.locator('[data-testid="login-useLocal"]');

    if (await useLocal.isVisible({ timeout: 3000 }).catch(() => false)) {
      await useLocal.click();
    }
  }

  submitButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="login-submit"]');
  }

  confirmationAcceptButton(): ComponentPo {
    return new ComponentPo(this.page, '[data-testid="login-confirmation-accept-button"]');
  }

  loginPageMessage(): Locator {
    return this.page.getByTestId('login__messages');
  }

  loginBackgroundImage(): Locator {
    return this.page.getByTestId('login-landscape__img');
  }

  localSelector(): Locator {
    return this.page.getByTestId('locale-selector');
  }
}
