import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';

export class ProjectsNamespacesListPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/projectsnamespaces`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, ProjectsNamespacesListPagePo.createPath(clusterId));
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="sortable-table-list-container"]');
  }

  baseResourceList(): BaseResourceList {
    return new BaseResourceList(this.page, '.dashboard-root');
  }

  createNamespaceButton(): Locator {
    return this.self().locator('[data-testid="create_project_namespaces"]');
  }
}

export class ProjectCreateEditPagePo extends PagePo {
  private static createPath(clusterId: string, projName?: string) {
    const root = `/c/${clusterId}/explorer/management.cattle.io.project`;

    return projName ? `${root}/${projName}` : `${root}/create`;
  }

  constructor(page: Page, clusterId = 'local', projName?: string) {
    super(page, ProjectCreateEditPagePo.createPath(clusterId, projName));
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  addProjectMemberButton(): Locator {
    return this.self().locator('[data-testid="add-item"]');
  }
}

export class NamespaceCreateEditPagePo extends PagePo {
  private static createPath(clusterId: string, nsName?: string) {
    const root = `/c/${clusterId}/explorer/namespace`;

    return nsName ? `${root}/${nsName}` : `${root}/create`;
  }

  constructor(page: Page, clusterId = 'local', nsName?: string) {
    super(page, NamespaceCreateEditPagePo.createPath(clusterId, nsName));
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }
}
