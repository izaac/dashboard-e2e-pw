import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';

export default class AmazonCognitoPo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/auth/config/cognito?mode=edit`;
  }

  constructor(page: Page, clusterId = '_') {
    super(page, AmazonCognitoPo.createPath(clusterId));
  }

  clientIdInputField(): Locator {
    return this.self().locator('[data-testid="oidc-client-id"]');
  }

  clientSecretInputField(): Locator {
    return this.self().locator('[data-testid="oidc-client-secret"]');
  }

  issuerInputField(): Locator {
    return this.self().locator('[data-testid="oidc-issuer"]');
  }

  async enterClientId(id: string): Promise<void> {
    await new LabeledInputPo(this.page, '[data-testid="oidc-client-id"]').set(id);
  }

  async enterClientSecret(secret: string): Promise<void> {
    await new LabeledInputPo(this.page, '[data-testid="oidc-client-secret"]').set(secret);
  }

  async enterIssuerUrl(url: string): Promise<void> {
    await new LabeledInputPo(this.page, '[data-testid="oidc-issuer"]').set(url);
  }

  saveButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="form-save"]', this.self());
  }

  async save(): Promise<void> {
    await new AsyncButtonPo(this.page, '[data-testid="form-save"]').click();
  }

  permissionsWarningBanner(): Locator {
    return this.self().locator('[data-testid="auth-provider-admin-permissions-warning-banner"]');
  }

  cognitoBanner(): Locator {
    return this.self().locator('[data-testid="oidc-cognito-banner"]');
  }
}
