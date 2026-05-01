import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import CruResourcePo from '@/e2e/po/components/cru-resource.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';

export class ProjectSecretsListPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/projectsecret`;
  }

  constructor(page: Page, clusterId: string) {
    super(page, ProjectSecretsListPagePo.createPath(clusterId));
  }

  title(): Locator {
    return this.self().locator('.title h1');
  }

  createButton(): Locator {
    return this.self().getByTestId('secrets-list-create');
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="sortable-table-list-container"]');
  }
}

export class ProjectSecretsCreateEditPo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/projectsecret/create`;
  }

  constructor(page: Page, clusterId: string) {
    super(page, ProjectSecretsCreateEditPo.createPath(clusterId));
  }

  cruResource(): CruResourcePo {
    return new CruResourcePo(this.page, '[data-testid="cru-form"]');
  }

  selectSecretSubtype(subtype: string): Locator {
    return this.cruResource().findSubTypeByName(subtype);
  }

  projectSelect(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="secret-project-select"]');
  }

  nameNsDescription(): NameNsDescriptionPo {
    return new NameNsDescriptionPo(this.page, ':scope', this.self());
  }

  basicAuthUsernameInput(): LabeledInputPo {
    // The username <input> carries the testid directly, so anchor on it.
    // (LabeledInputPo.bySelector appends ' input' which would miss this.)
    return new LabeledInputPo(this.page, '[data-testid="secret-basic-username"]', this.self());
  }

  basicAuthPasswordInput(): LabeledInputPo {
    // Password input has no testid; anchor directly on the only type="password" input
    // inside the create form.
    return new LabeledInputPo(this.page, '[data-testid="cru-form"] input[type="password"]');
  }

  saveOrCreate(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="form-save"]', this.self());
  }
}
