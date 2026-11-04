import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';

export class SecretsListPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/secret`;
  }

  constructor(page: Page, clusterId: string) {
    super(page, SecretsListPagePo.createPath(clusterId));
  }

  title(): Locator {
    return this.self().locator('.title h1');
  }

  createButton(): Locator {
    return this.self().locator('[data-testid="secrets-list-create"]');
  }

  createButtonTitle(): Locator {
    return this.createButton();
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '[data-testid="sortable-table-list-container"]');
  }

  /** List filter box: the new-UX query box, falling back to the legacy search row */
  filterInput(): Locator {
    return this.page
      .getByTestId('table-views-query')
      .or(this.page.getByTestId('search-box-filter-row').getByRole('textbox'))
      .first();
  }

  async filterByName(text: string): Promise<void> {
    const input = this.filterInput();

    await input.focus();
    await input.clear();
    await input.fill(text);
  }
}

export class SecretsCreateEditPo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/secret/create`;
  }

  constructor(page: Page, clusterId: string) {
    super(page, SecretsCreateEditPo.createPath(clusterId));
  }

  resourceDetail(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }
}
