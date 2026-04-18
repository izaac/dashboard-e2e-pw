import type { Page, Locator, Response } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import KeyValuePo from '@/e2e/po/components/key-value.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';

export default class ChartRepositoriesCreateEditPo extends PagePo {
  private static createPath(clusterId: string, product: 'apps' | 'manager', repoName?: string) {
    const root = `/c/${clusterId}/${product}/catalog.cattle.io.clusterrepo`;

    return repoName ? `${root}/${repoName}` : `${root}/create`;
  }

  constructor(page: Page, clusterId = '_', product: 'apps' | 'manager' = 'manager', repoName?: string) {
    super(page, ChartRepositoriesCreateEditPo.createPath(clusterId, product, repoName));
  }

  nameNsDescription(): NameNsDescriptionPo {
    return new NameNsDescriptionPo(this.page, ':scope', this.self());
  }

  gitRepoUrl(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Git Repo URL');
  }

  gitBranch(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Git Branch');
  }

  ociUrl(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'OCI Repository Host URL');
  }

  helmUrlInput(): Locator {
    return this.page.getByTestId('clusterrepo-helm-url-input');
  }

  ociUrlInput(): Locator {
    return this.page.getByTestId('clusterrepo-oci-url-input');
  }

  ociCaBundleInput(): Locator {
    return this.page.getByTestId('clusterrepo-oci-cabundle-input');
  }

  ociMinWaitInput(): Locator {
    return this.page.getByTestId('clusterrepo-oci-min-wait-input');
  }

  ociMaxWaitInput(): Locator {
    return this.page.getByTestId('clusterrepo-oci-max-wait-input');
  }

  ociMaxRetriesInput(): Locator {
    return this.page.getByTestId('clusterrepo-oci-max-retries-input');
  }

  gitRepoBranchInput(): Locator {
    return this.page.getByTestId('clusterrepo-git-branch-input');
  }

  gitRepoUrlInput(): Locator {
    return this.page.getByTestId('clusterrepo-git-repo-input');
  }

  authentication(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '.vs__dropdown-toggle');
  }

  repoRcItemCard(id: string): Locator {
    return this.page.getByTestId(`item-card-${id}`);
  }

  async selectGitRepoCard(): Promise<void> {
    await this.repoRcItemCard('git-repo').click();
  }

  async selectOciUrlCard(): Promise<void> {
    await this.repoRcItemCard('oci-url').click();
  }

  async selectHelmUrlCard(): Promise<void> {
    await this.repoRcItemCard('helm-url').click();
  }

  lablesAnnotationsKeyValue(): KeyValuePo {
    return new KeyValuePo(this.page, ':scope', this.self());
  }

  saveCreateForm(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="action-button-async-button"]', this.self());
  }

  /** Name input inside the name-ns-description component */
  nameInput(): Locator {
    return this.self().locator('[data-testid="name-ns-description-name"] input');
  }

  /** Git repo type card selector */
  gitRepoCard(): Locator {
    return this.self().locator('[data-testid="item-card-git-repo"]');
  }

  /** Git repo URL input */
  gitRepoInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="clusterrepo-git-repo-input"]', this.self());
  }

  /** Git branch input */
  gitBranchInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="clusterrepo-git-branch-input"]', this.self());
  }

  /** Create/Save async button */
  saveButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="action-button-async-button"]', this.self());
  }

  authSelectOrCreate(selector: string): LabeledSelectPo {
    return new LabeledSelectPo(this.page, `${selector} [data-testid="auth-secret-select"]`);
  }

  clusterRepoAuthSelectOrCreate(): LabeledSelectPo {
    return this.authSelectOrCreate('[data-testid="clusterrepo-auth-secret"]');
  }

  authSecretUsername(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Username');
  }

  authSecretPassword(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Password');
  }

  authSecretSshPrivateKey(): Locator {
    return this.self().locator('.labeled-input:has-text("Private Key") textarea');
  }

  authSecretSshPublicKey(): Locator {
    return this.self().locator('.labeled-input:has-text("Public Key") textarea');
  }

  refreshIntervalInput(): Locator {
    return this.page.getByTestId('clusterrepo-refresh-interval');
  }

  async saveAndWaitForRequests(method: string, url: string): Promise<Response> {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes(url) && resp.request().method() === method,
      { timeout: 10000 },
    );

    await this.saveCreateForm().click();

    return responsePromise;
  }
}
