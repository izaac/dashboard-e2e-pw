import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';

export class FleetApplicationListPagePo extends PagePo {
  constructor(page: Page) {
    super(page, '/c/_/fleet/application');
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="sortable-table-list-container"]');
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
}
