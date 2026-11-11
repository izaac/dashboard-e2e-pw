import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';

export default class SamlPo extends PagePo {
  readonly provider: string;

  constructor(page: Page, provider = 'adfs', clusterId = 'local') {
    super(page, `/c/${clusterId}/auth/config/create/${provider}?mode=edit`);
    this.provider = provider;
  }

  async waitForForm(): Promise<void> {
    await expect(this.displayNameInput()).toBeVisible({ timeout: 60_000 });
    await expect(this.rancherApiHostInput()).toBeVisible({ timeout: 60_000 });
  }

  displayNameInput(): Locator {
    return this.page.getByTestId('saml-display-name-field');
  }

  userNameInput(): Locator {
    return this.page.getByTestId('saml-user-name-field');
  }

  uidInput(): Locator {
    return this.page.getByTestId('saml-uid-field');
  }

  groupsInput(): Locator {
    return this.page.getByTestId('saml-groups-field');
  }

  rancherApiHostInput(): Locator {
    return this.page.getByTestId('saml-rancher-api-host');
  }

  privateKeyTextarea(): Locator {
    return this.page.getByTestId('saml-key');
  }

  certificateTextarea(): Locator {
    return this.page.getByTestId('saml-cert');
  }

  metadataTextarea(): Locator {
    return this.page.getByTestId('saml-metadata');
  }

  ldapSearchHeading(): Locator {
    return this.page.getByRole('heading', { name: 'User and Group Search' });
  }

  ldapSearchCheckbox(): Locator {
    return this.page.getByTestId('saml-show-ldap');
  }

  ldapHostnameInput(): Locator {
    return this.page.getByTestId('ldap-hostname');
  }

  ldapPortInput(): Locator {
    return this.page.getByTestId('ldap-port');
  }

  ldapTlsCheckbox(): Locator {
    return this.page.locator('.tls-options input[type="checkbox"]').first();
  }

  ldapServiceAccountDnInput(): Locator {
    return this.page.getByTestId('ldap-service-account-dn');
  }

  ldapServiceAccountPasswordInput(): Locator {
    return this.page.getByTestId('ldap-service-account-password');
  }

  ldapUserSearchBaseInput(): Locator {
    return this.page.getByTestId('ldap-user-search-base');
  }

  ldapGroupSearchBaseInput(): Locator {
    return this.page.locator('input[placeholder*="ou=groups"]').first();
  }

  groupMembershipRadio(): Locator {
    return this.page.locator('input[name="groupMembership"], input[value="direct"], input[value="nested"]');
  }

  enableButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="form-save"]');
  }
}
