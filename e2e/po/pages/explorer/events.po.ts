import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';

export class EventsPageListPo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/event`;
  }

  constructor(page: Page, clusterId: string) {
    super(page, EventsPageListPo.createPath(clusterId));
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="sortable-table-list-container"]');
  }

  baseResourceList(): BaseResourceList {
    return new BaseResourceList(this.page, '.dashboard-root');
  }
}

export class EventsCreateEditPo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/event/create`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, EventsCreateEditPo.createPath(clusterId));
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }
}
