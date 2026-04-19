import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import GenericPrompt from '@/e2e/po/prompts/genericPrompt.po';
import ResourceListMastheadPo from '@/e2e/po/components/resource-list-masthead.po';
import CreateEditViewPo from '@/e2e/po/components/create-edit-view.po';

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

  masthead(): ResourceListMastheadPo {
    return new ResourceListMastheadPo(this.page, ':scope');
  }

  createEditView(): CreateEditViewPo {
    return new CreateEditViewPo(this.page, '.dashboard-root');
  }

  flatListButton(): Locator {
    return this.self().getByRole('button', { name: 'Flat List' });
  }

  createNamespaceButton(): Locator {
    // In grouped view the create-namespace action is a per-project link; fall back to
    // the legacy masthead button for older Rancher versions that still render it.
    return this.self()
      .getByRole('link', { name: 'Create Namespace' })
      .first()
      .or(this.self().locator('[data-testid="create_project_namespaces"]'));
  }

  projectSelect(): Locator {
    return this.page.getByTestId('name-ns-description-project');
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

  tabResourceQuotas(): Locator {
    return this.self().locator('[data-testid="btn-resource-quotas"]');
  }

  btnAddResource(): Locator {
    return this.self().locator('[data-testid="btn-add-resource"]');
  }

  inputProjectLimit(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="projectrow-project-quota-input"]');
  }

  inputNamespaceDefaultLimit(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="projectrow-namespace-quota-input"]');
  }

  tabContainerDefaultResourceLimit(): Locator {
    return this.self().locator('[data-testid="btn-container-default-resource-limit"]');
  }

  inputCpuReservation(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="cpu-reservation"]');
  }

  inputMemoryReservation(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="memory-reservation"]');
  }

  inputCpuLimit(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="cpu-limit"]');
  }

  inputMemoryLimit(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="memory-limit"]');
  }

  selectResourceType(): Locator {
    return this.page.locator('[data-testid="projectrow-type-input"]');
  }

  bannerError(n: number): Locator {
    return this.self().locator(`[data-testid="error-banner${n}"]`);
  }

  addProjectMemberButton(): Locator {
    return this.self().locator('[data-testid="add-item"]');
  }

  addProjectMemberModal(): GenericPrompt {
    return new GenericPrompt(this.page);
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
