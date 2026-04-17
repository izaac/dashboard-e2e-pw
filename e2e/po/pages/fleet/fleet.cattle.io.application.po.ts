import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';

export class FleetApplicationCreatePo extends PagePo {
  constructor(page: Page) {
    super(page, '/c/_/fleet/application/create');
  }

  async createGitRepo(): Promise<void> {
    await this.self().locator('[data-testid="subtype-banner-item-fleet.cattle.io.gitrepo"]').click();
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
