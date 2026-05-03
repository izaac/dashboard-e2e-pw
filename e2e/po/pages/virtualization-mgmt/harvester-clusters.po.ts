import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';

export class HarvesterClusterPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/harvesterManager/harvesterhci.io.management.cluster`;
  }

  private clusterId: string;

  constructor(page: Page, clusterId = '_') {
    super(page, HarvesterClusterPagePo.createPath(clusterId));
    this.clusterId = clusterId;
  }

  async navTo(): Promise<void> {
    const burgerMenu = new BurgerMenuPo(this.page);

    await burgerMenu.toggle();
    await burgerMenu.burgerMenuNavToMenuByLabel('Virtualization Management');
  }

  masthead(): ResourceListMastheadLocator {
    return new BaseResourceList(this.page, '.dashboard-root', this.self()).masthead();
  }

  title(): Locator {
    return this.masthead().title();
  }

  importHarvesterClusterButton(): Locator {
    return this.masthead().actions();
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="sortable-table-list-container"]');
  }

  extensionWarning(): Locator {
    return this.self().locator('.extension-warning');
  }

  harvesterLogo(): Locator {
    return this.self().locator('div.logo');
  }

  harvesterTagline(): Locator {
    return this.self().locator('div.tagline');
  }

  updateOrInstallButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="action-button-async-button"]', this.self());
  }

  createHarvesterClusterForm(namespace?: string, id?: string): HarvesterClusterCreateEditPo {
    return new HarvesterClusterCreateEditPo(this.page, this.clusterId, namespace, id);
  }
}

export class HarvesterClusterCreateEditPo extends PagePo {
  private static createPath(clusterId: string, namespace?: string, id?: string) {
    const root = `/c/${clusterId}/harvesterManager/harvesterhci.io.management.cluster`;

    return id ? `${root}/${namespace}/${id}` : `${root}/create`;
  }

  constructor(page: Page, clusterId = '_', namespace?: string, id?: string) {
    super(page, HarvesterClusterCreateEditPo.createPath(clusterId, namespace, id));
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  masthead() {
    return new BaseResourceList(this.page, ':scope', this.self()).masthead();
  }

  title(): Locator {
    return this.masthead().title();
  }

  nameNsDescription(): NameNsDescriptionPo {
    return new NameNsDescriptionPo(this.page, ':scope', this.self());
  }

  tabs(): TabbedPo {
    return new TabbedPo(this.page, '[data-testid="tabbed"]');
  }

  async memberRolesTab(): Promise<void> {
    await this.tabs().tabBySelector('[data-testid="memberRoles"]').click();
  }
}

export class HarvesterClusterDetailsPo extends PagePo {
  private static createPath(clusterId: string, namespace: string, id: string) {
    return `/c/${clusterId}/harvesterManager/harvesterhci.io.management.cluster/${namespace}/${id}`;
  }

  constructor(page: Page, clusterId = '_', namespace = 'fleet-default', id: string) {
    super(page, HarvesterClusterDetailsPo.createPath(clusterId, namespace, id));
  }

  masthead() {
    return new BaseResourceList(this.page, '.dashboard-root', this.self()).masthead();
  }

  title(): Locator {
    return this.masthead().title();
  }
}

// Re-export masthead type for convenience
type ResourceListMastheadLocator = ReturnType<BaseResourceList['masthead']>;
