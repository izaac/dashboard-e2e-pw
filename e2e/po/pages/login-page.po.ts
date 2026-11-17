import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import PasswordPo from '@/e2e/po/components/password.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import ComponentPo from '@/e2e/po/components/component.po';
import { DEBOUNCE } from '@/support/timeouts';

/** Key the login page stores the remembered provider under (shell/utils/auth-providers.ts). */
const REMEMBERED_PROVIDER_KEY = 'rancher-login-provider';

export class LoginPagePo extends PagePo {
  static url = '/auth/login';

  constructor(page: Page) {
    super(page, LoginPagePo.url);
  }

  async goTo(params?: string, fragment?: string): Promise<void> {
    await super.goTo(params, fragment);
  }

  username(): LabeledInputPo {
    return new LabeledInputPo(
      this.page,
      '[data-testid="local-login-username"] input, [data-testid="local-login-username"]',
    );
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

  /** Revoke the current session by visiting the logout route (the login form is the landing page afterwards). */
  async logout(): Promise<void> {
    await this.page.goto('./auth/logout', { waitUntil: 'domcontentloaded' });
  }

  useLocal(): Locator {
    return this.page.locator('[data-testid="login-useLocal"]');
  }

  async switchToLocal(): Promise<void> {
    if (
      await this.useLocal()
        .isVisible({ timeout: DEBOUNCE })
        .catch(() => false)
    ) {
      await this.useLocal().click();
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

  /** Welcome heading on the login card (e.g. "Welcome to Rancher Community") */
  welcomeHeading(): Locator {
    return this.page.locator('h1.login-welcome');
  }

  loginBackgroundImage(): Locator {
    return this.page.getByTestId('login-landscape__img');
  }

  localSelector(): Locator {
    return this.page.getByTestId('locale-selector');
  }

  cliLoginContainer(): Locator {
    return this.page.locator('.cli-login');
  }

  cliLoginError(): Locator {
    return this.page.locator('.cli-error');
  }

  cliLoginCode(): Locator {
    return this.page.locator('.cli-login-code');
  }

  providerSubmitButton(): Locator {
    return this.page.getByTestId('login-provider-submit');
  }

  /**
   * The provider list, shown in place of the login once the user asks for a
   * different provider. Only offered when there is more than one external
   * provider to weigh up.
   */
  providerList(): Locator {
    return this.page.getByTestId('login-provider-list');
  }

  /** The scrolling part of the list, which holds the external providers. */
  providerScrollList(): Locator {
    return this.page.getByTestId('login-provider-scroll');
  }

  /** Every provider row in the list, in the order the page offers them. */
  providerOptions(): Locator {
    return this.page.locator('[data-testid^="login-provider-option-"]');
  }

  /** A provider row in the list, keyed by its authconfig name. */
  providerOption(id: string): Locator {
    return this.page.getByTestId(`login-provider-option-${id}`);
  }

  /**
   * The link off the login on screen: to the list where there is one, or straight
   * to the single external provider where there is not.
   */
  chooseDifferentProvider(): Locator {
    return this.page.getByTestId('login-provider-choose');
  }

  /** Swap the login on screen for the list of providers. */
  async openProviderList(): Promise<void> {
    await this.chooseDifferentProvider().click();
  }

  /** Pick a provider out of the list. This only changes what the page offers. */
  async selectProvider(id: string): Promise<void> {
    await this.providerOption(id).click();
  }

  /** Checkbox below the list that keeps the chosen provider on this device. */
  rememberProviderCheckbox(): CheckboxInputPo {
    return new CheckboxInputPo(this.page, '[data-testid="login-provider-remember"]');
  }

  /** The "OR" rule between the sign-in button and the provider link. */
  orDivider(): Locator {
    return this.page.locator('.or-divider');
  }

  /** Username field of the directory (LDAP) login form. */
  ldapUsername(): Locator {
    return this.page.getByTestId('ldap-login-username');
  }

  /** Password field of the directory (LDAP) login form, with its show and hide control. */
  ldapPassword(): PasswordPo {
    return new PasswordPo(this.page, '[data-testid="ldap-login-password"]');
  }

  /** Banners rendered between the welcome heading and the sign-in form. */
  messageBanners(): Locator {
    return this.loginPageMessage().locator('.banner');
  }

  /** Rendered gap, in px, between the messages block and the panel block above it. */
  async gapAboveMessages(): Promise<number> {
    return this.gapToMessages('above');
  }

  /** Rendered gap, in px, between the messages block and the panel block below it. */
  async gapBelowMessages(): Promise<number> {
    return this.gapToMessages('below');
  }

  /**
   * Measured from bounding boxes rather than CSS, so the number is the spacing a
   * user sees rather than a declared property that a later rule could override.
   */
  private async gapToMessages(side: 'above' | 'below'): Promise<number> {
    const messages = this.loginPageMessage();
    const sibling = messages.locator(`xpath=${side === 'above' ? 'preceding' : 'following'}-sibling::*[1]`);
    const messagesBox = await messages.boundingBox();
    const siblingBox = await sibling.boundingBox();

    if (!messagesBox || !siblingBox) {
      throw new Error(
        `Cannot measure the login messages gap ${side}: ` +
          `messages box ${JSON.stringify(messagesBox)}, sibling box ${JSON.stringify(siblingBox)}`,
      );
    }

    return side === 'above'
      ? messagesBox.y - (siblingBox.y + siblingBox.height)
      : siblingBox.y - (messagesBox.y + messagesBox.height);
  }

  /**
   * The provider this device was told to remember, or null when none is stored.
   * localStorage has no locator, so this reads it in the page.
   */
  async rememberedProviderId(): Promise<string | null> {
    return this.page.evaluate((key) => window.localStorage.getItem(key), REMEMBERED_PROVIDER_KEY);
  }

  /** Provider a device was told to remember is stored under this key. */
  static readonly rememberedProviderKey = REMEMBERED_PROVIDER_KEY;
}
