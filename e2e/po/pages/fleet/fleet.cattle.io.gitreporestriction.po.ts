import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';

export class FleetGitRepoRestrictionListPagePo extends PagePo {
  static url = '/c/_/fleet/fleet.cattle.io.gitreporestriction';

  constructor(page: Page) {
    super(page, FleetGitRepoRestrictionListPagePo.url);
  }

  baseResourceList(): BaseResourceList {
    return new BaseResourceList(this.page, ':scope', this.self());
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="sortable-table-list-container"]');
  }
}

export class FleetRestrictionCreateEditPo extends PagePo {
  private static createPath(workspace?: string, id?: string) {
    const root = '/c/_/fleet/fleet.cattle.io.gitreporestriction';

    return id ? `${root}/${workspace}/${id}` : `${root}/create`;
  }

  constructor(page: Page, workspace?: string, id?: string) {
    super(page, FleetRestrictionCreateEditPo.createPath(workspace, id));
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }
}
