import type { Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import { BRIEF } from '@/support/timeouts';

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

  private githubAppIdInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="auth-secret-github-app-id"]', this.self());
  }

  private githubAppInstallationIdInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="auth-secret-github-app-installation-id"]', this.self());
  }

  private githubAppPrivateKeyInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="auth-secret-github-app-private-key"]', this.self());
  }

  async setBasicAuthSecret(username: string, password: string): Promise<void> {
    await this.usernameInput().set(username);
    await this.passwordInput().set(password);
  }

  async setSSHSecret(privateKey: string, publicKey: string): Promise<void> {
    await this.sshPrivateKeyInput().set(privateKey);
    await this.sshPublicKeyInput().set(publicKey);
  }

  async setGitHubAppSecret(appId: string, installationId: string, privateKey: string): Promise<void> {
    await this.githubAppIdInput().set(appId);
    await this.githubAppInstallationIdInput().set(installationId);
    await this.githubAppPrivateKeyInput().set(privateKey);
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

  async createGitHubAppAuth(
    appId = 'auth-test-app-id',
    installationId = 'auth-test-installation-id',
    privateKey = 'auth-test-private-key',
  ): Promise<void> {
    await this.waitForNotLoading();
    await this.authSelect().self().scrollIntoViewIfNeeded();
    await this.authSelect().dropdown().click();
    await this.authSelect().isOpened();
    await this.authSelect().clickOptionWithLabel('Create a GitHub App Auth Secret');
    await this.setGitHubAppSecret(appId, installationId, privateKey);
  }

  async waitForNotLoading(): Promise<void> {
    await this.loading().waitFor({ state: 'detached', timeout: BRIEF });
  }
}
