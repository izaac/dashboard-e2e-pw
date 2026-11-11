import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import { VERY_LONG } from '@/support/timeouts';

export default class OpenLdapPo extends PagePo {
  constructor(page: Page, path = '/c/local/auth/config/create/openldap?mode=edit') {
    super(page, path);
  }

  /**
   * The auth config form is rendered after the provider type list and the existing configs
   * resolve, which can take longer than the default assertion timeout on a cold navigation.
   * The create route also re-applies the `mode=edit` query on mount, which remounts the form,
   * so settle after the first render before interacting with the inputs.
   */
  async waitForForm(): Promise<void> {
    await expect(this.page.getByTestId('auth-config-name')).toBeVisible({ timeout: VERY_LONG });
    await expect(this.hostnameInput()).toBeVisible({ timeout: VERY_LONG });
    await expect(this.page).toHaveURL(/\/auth\/config\/(create\/)?openldap\?mode=edit/, { timeout: VERY_LONG });
    await expect(this.hostnameInput()).toBeVisible({ timeout: VERY_LONG });
  }

  nameInput(): Locator {
    return this.page.getByTestId('auth-config-name');
  }

  hostnameInput(): Locator {
    return this.page.getByTestId('ldap-hostname');
  }

  portInput(): Locator {
    return this.page.getByTestId('ldap-port');
  }

  serviceAccountDnInput(): Locator {
    return this.page.getByTestId('ldap-service-account-dn');
  }

  serviceAccountPasswordInput(): Locator {
    return this.page.getByTestId('ldap-service-account-password');
  }

  userSearchBaseInput(): Locator {
    return this.page.getByTestId('ldap-user-search-base');
  }

  groupSearchBaseInput(): Locator {
    return this.page.locator('input[placeholder*="ou=groups"]').first();
  }

  userIdAttributeInput(): Locator {
    return this.page.getByTestId('ldap-user-id-attribute');
  }

  groupIdAttributeInput(): Locator {
    return this.page.getByTestId('ldap-group-id-attribute');
  }

  testUsernameInput(): Locator {
    return this.page.getByTestId('ldap-test-username');
  }

  testPasswordInput(): Locator {
    return this.page.locator('[data-testid="ldap-test-password"] input');
  }

  enableButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="form-save"]');
  }

  editConfigButton(): Locator {
    return this.page
      .getByRole('button', { name: 'Edit Config' })
      .or(this.page.locator('a:has-text("Edit Config"), button:has-text("Edit Config")'));
  }

  disableButton(): Locator {
    return this.page
      .getByRole('button', { name: 'Disable' })
      .or(this.page.locator('a:has-text("Disable"), button:has-text("Disable")'));
  }

  acknowledgeDisableCheckbox(): Locator {
    return this.page.locator('[data-testid="disable-auth-provider-acknowledge"] .checkbox-container');
  }

  confirmDisableButton(): Locator {
    return this.page.locator('[data-testid="disable-auth-provider-confirm-button"]');
  }

  async disableProvider(): Promise<void> {
    await this.disableButton().click();
    await this.acknowledgeDisableCheckbox().click();
    await this.confirmDisableButton().click();
  }
}
