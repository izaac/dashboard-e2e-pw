import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';

export default class GithubAppPo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/auth/config/githubapp?mode=edit`;
  }

  constructor(page: Page, clusterId = '_') {
    super(page, GithubAppPo.createPath(clusterId));
  }

  clientIdInputField(): Locator {
    return this.self().locator('[data-testid="client-id"]');
  }

  async enterClientId(id: string): Promise<void> {
    await new LabeledInputPo(this.page, '[data-testid="client-id"]').set(id);
  }

  clientSecretInputField(): Locator {
    return this.self().locator('[data-testid="client-secret"]');
  }

  async enterClientSecret(val: string): Promise<void> {
    await new LabeledInputPo(this.page, '[data-testid="client-secret"]').set(val);
  }

  gitHubAppIdInputField(): Locator {
    return this.self().locator('[data-testid="app-id"]');
  }

  async enterGitHubAppId(val: string): Promise<void> {
    await new LabeledInputPo(this.page, '[data-testid="app-id"]').set(val);
  }

  installationIdInputField(): Locator {
    return this.self().locator('[data-testid="installation-id"]');
  }

  async enterInstallationId(val: string): Promise<void> {
    await new LabeledInputPo(this.page, '[data-testid="installation-id"]').set(val);
  }

  privateKeyInputField(): Locator {
    return this.self().locator('[data-testid="private-key"]');
  }

  async enterPrivateKey(val: string): Promise<void> {
    await new LabeledInputPo(this.page, '[data-testid="private-key"]').set(val);
  }

  saveButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="form-save"]', this.self());
  }

  async save(): Promise<void> {
    await new AsyncButtonPo(this.page, '[data-testid="form-save"]').click();
  }

  gitHubAppBanner(): Locator {
    return this.self().locator('[data-testid="github-app-banner"]');
  }

  permissionsWarningBanner(): Locator {
    return this.self().locator('[data-testid="auth-provider-admin-permissions-warning-banner"]');
  }
}
