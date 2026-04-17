import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import PasswordPo from '@/e2e/po/components/password.po';

export default class AccountPagePo extends PagePo {
  static url = '/account';

  constructor(page: Page) {
    super(page, AccountPagePo.url);
  }

  async title(): Promise<void> {
    await expect(this.page.locator('h1')).toHaveText('Account and API Keys');
  }

  createApiKeyButton(): Locator {
    return this.page.getByTestId('account_create_api_keys');
  }

  changePasswordButton(): Locator {
    return this.page.getByTestId('account_change_password');
  }

  async create(): Promise<void> {
    await this.createApiKeyButton().click();
  }

  async changePassword(): Promise<void> {
    await this.changePasswordButton().click();
  }

  changePasswordModal(): Locator {
    return this.page.getByTestId('change-password__modal');
  }

  currentPassword(): PasswordPo {
    return new PasswordPo(this.page, '[data-testid="account__current_password"]');
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="api_keys_list"]');
  }
}
