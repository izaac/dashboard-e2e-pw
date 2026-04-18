import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';

export class FleetApplicationListPagePo extends PagePo {
  constructor(page: Page) {
    super(page, '/c/_/fleet/application');
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="sortable-table-list-container"]');
  }

  resourceTableDetails(name: string, column: number): Locator {
    return this.sortableTable().self().locator(`tr:has-text("${name}") td`).nth(column);
  }

  sortableTable(): SortableTablePo {
    return new SortableTablePo(this.page, '[data-testid="sortable-table-list-container"]');
  }

  async goToDetailsPage(name: string): Promise<void> {
    await this.sortableTable().detailsPageLinkWithName(name).click();
  }
}

export class FleetApplicationCreatePo extends PagePo {
  constructor(page: Page) {
    super(page, '/c/_/fleet/application/create');
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  async createGitRepo(): Promise<void> {
    await this.self().locator('[data-testid="subtype-banner-item-fleet.cattle.io.gitrepo"]').click();
  }

  async createHelmOp(): Promise<void> {
    await this.self().locator('[data-testid="subtype-banner-item-fleet.cattle.io.helmop"]').click();
  }
}

export class FleetGitRepoCreateEditPo extends PagePo {
  private static createPath(fleetWorkspace?: string, gitRepoName?: string) {
    const root = '/c/_/fleet/application/fleet.cattle.io.gitrepo';

    return fleetWorkspace ? `${root}/${fleetWorkspace}/${gitRepoName}` : `${root}/create`;
  }

  constructor(page: Page, fleetWorkspace?: string, gitRepoName?: string) {
    super(page, FleetGitRepoCreateEditPo.createPath(fleetWorkspace, gitRepoName));
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  async setGitRepoUrl(url: string): Promise<void> {
    await this.self()
      .locator('label:has-text("Repository URL") + div input, [data-testid="gitrepo-repo-url"]')
      .fill(url);
  }

  async setBranchName(branch: string): Promise<void> {
    await this.self().locator('label:has-text("Branch") + div input, [data-testid="gitrepo-branch"]').fill(branch);
  }

  async setGitRepoPath(path: string): Promise<void> {
    await this.self()
      .locator('[data-testid="gitRepo-paths"] button:has-text("Add Path"), [data-testid="gitRepo-paths"] .btn')
      .click();
    await this.self().locator('[data-testid="gitRepo-paths"] [data-testid="main-path"]').fill(path);
  }

  async setHelmRepoURLRegex(regex: string): Promise<void> {
    await this.self().locator('[data-testid="gitrepo-helm-repo-url-regex"]').fill(regex);
  }

  async setPollingInterval(value: number): Promise<void> {
    await this.self().locator('label:has-text("Polling Interval") + div input').fill(String(value));
  }

  targetClusterOptions(): Locator {
    return this.self().locator('[data-testid="fleet-target-cluster-radio-button"]');
  }

  targetCluster(): Locator {
    return this.self().locator('[data-testid="fleet-target-cluster-name-selector"]');
  }

  async mastheadTitle(): Promise<string> {
    return (await this.self().locator('.primaryheader h1, .title-bar h1').textContent()) ?? '';
  }
}

export class FleetGitRepoDetailsPo extends PagePo {
  private static createPath(fleetWorkspace: string, gitRepoName: string) {
    return `/c/_/fleet/application/fleet.cattle.io.gitrepo/${fleetWorkspace}/${gitRepoName}`;
  }

  constructor(page: Page, fleetWorkspace: string, gitRepoName: string) {
    super(page, FleetGitRepoDetailsPo.createPath(fleetWorkspace, gitRepoName));
  }

  gitRepoTabs(): TabbedPo {
    return new TabbedPo(this.page, '[data-testid="tabbed-block"]');
  }

  bundlesList(): SortableTablePo {
    return new SortableTablePo(this.page, '#bundles [data-testid="sortable-table-list-container"]');
  }
}

export class FleetGitRepoListPagePo extends PagePo {
  constructor(page: Page) {
    super(page, '/c/_/fleet/fleet.cattle.io.gitrepo');
  }

  sortableTable(): SortableTablePo {
    return new SortableTablePo(this.page, '[data-testid="sortable-table-list-container"]');
  }

  async goToDetailsPage(name: string): Promise<void> {
    await this.sortableTable().detailsPageLinkWithName(name).click();
  }
}
