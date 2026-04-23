import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import PasswordPo from '@/e2e/po/components/password.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import { STANDARD } from '@/support/timeouts';

export default class AccountPagePo extends PagePo {
  static url = '/account';

  constructor(page: Page) {
    super(page, AccountPagePo.url);
  }

  async waitForRequests(): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes('/v3/tokens') && resp.status() === 200,
      { timeout: STANDARD },
    );

    await this.goTo();
    await responsePromise;
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

  applyButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="action-button-async-button"]', this.self());
  }

  async apply(): Promise<void> {
    await this.applyButton().click();
  }

  async cancel(): Promise<void> {
    await this.self().locator('button[type="reset"]').click();
  }

  newPassword(): PasswordPo {
    return new PasswordPo(this.page, '[data-testid="account__new_password"]');
  }

  confirmPassword(): PasswordPo {
    return new PasswordPo(this.page, '[data-testid="account__confirm_password"]');
  }

  sortableTable(): SortableTablePo {
    return this.list().resourceTable().sortableTable();
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="api_keys_list"]');
  }
}
