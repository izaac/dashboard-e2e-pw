import type { Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';

export default class SelectOrCreateAuthPo extends ComponentPo {
  authSelect(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="auth-secret-select"]', this.self());
  }

  loading(): Locator {
    return this.self().locator('i.icon-spinner');
  }

  private usernameInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="auth-secret-basic-username"]', this.self());
  }

  private passwordInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="auth-secret-basic-password"]', this.self());
  }

  private sshPrivateKeyInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="auth-secret-ssh-private-key"]', this.self());
  }

  private sshPublicKeyInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="auth-secret-ssh-public-key"]', this.self());
  }

  async setBasicAuthSecret(username: string, password: string): Promise<void> {
    await this.usernameInput().set(username);
    await this.passwordInput().set(password);
  }

  async setSSHSecret(privateKey: string, publicKey: string): Promise<void> {
    await this.sshPrivateKeyInput().set(privateKey);
    await this.sshPublicKeyInput().set(publicKey);
  }

  async createBasicAuth(username = 'auth-test-user', password = 'auth-test-password'): Promise<void> {
    await this.waitForNotLoading();
    await this.authSelect().dropdown().click();
    await this.authSelect().clickOptionWithLabel('Create an HTTP Basic Auth Secret');
    await this.setBasicAuthSecret(username, password);
  }

  async createSSHAuth(privateKey: string, publicKey: string): Promise<void> {
    await this.waitForNotLoading();
    await this.authSelect().self().scrollIntoViewIfNeeded();
    await this.authSelect().dropdown().click();
    await this.authSelect().isOpened();
    await this.authSelect().clickOptionWithLabel('Create an SSH Key Secret');
    await this.setSSHSecret(privateKey, publicKey);
  }

  async createRKEAuth(username = 'auth-test-user', password = 'auth-test-password'): Promise<void> {
    await this.waitForNotLoading();
    await this.authSelect().self().scrollIntoViewIfNeeded();
    await this.authSelect().dropdown().click();
    await this.authSelect().isOpened();
    await this.authSelect().clickOptionWithLabel('Create an RKE Auth Config Secret');
    await this.setBasicAuthSecret(username, password);
  }

  async waitForNotLoading(): Promise<void> {
    await expect(this.loading()).not.toBeAttached({ timeout: 5000 });
  }
}
