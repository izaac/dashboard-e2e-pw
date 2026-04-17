import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import SelectIconGridPo from '@/e2e/po/components/select-icon-grid.po';

export enum AuthProvider {
  AMAZON_COGNITO = 'Amazon Cognito',
  AZURE = 'AzureAD',
  GITHUB_APP = 'GitHub App',
}

export default class AuthProviderPo extends PagePo {
  private clusterId: string;

  private static createPath(clusterId: string) {
    return `/c/${clusterId}/auth/config`;
  }

  constructor(page: Page, clusterId = '_') {
    super(page, AuthProviderPo.createPath(clusterId));
    this.clusterId = clusterId;
  }

  selectionGrid(): SelectIconGridPo {
    return new SelectIconGridPo(this.page, this.selector);
  }

  async selectProvider(provider: AuthProvider): Promise<void> {
    await this.selectionGrid().select(provider);
  }

  async goToAzureADCreation(clusterId = '_'): Promise<void> {
    await this.page.goto(`./c/${clusterId}/auth/config/azuread?mode=edit`, { waitUntil: 'domcontentloaded' });
  }

  async goToAmazonCognitoCreation(clusterId = '_'): Promise<void> {
    await this.page.goto(`./c/${clusterId}/auth/config/cognito?mode=edit`, { waitUntil: 'domcontentloaded' });
  }
}
