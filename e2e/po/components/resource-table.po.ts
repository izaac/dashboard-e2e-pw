import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';

export default class ResourceTablePo extends ComponentPo {
  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  sortableTable(): SortableTablePo {
    return new SortableTablePo(this.page, '.sortable-table', this.self());
  }

  downloadYamlButton(): Locator {
    return this.page.getByTestId('sortable-table-download');
  }

  snapshotNowButton(): Locator {
    return this.page.locator('[data-testid="action-button-async-button"]').last();
  }

  resourceTableDetails(name: string, index: number): Locator {
    return this.sortableTable().rowWithName(name).column(index);
  }

  async goToDetailsPage(name: string, selector?: string): Promise<void> {
    await this.sortableTable().detailsPageLinkWithName(name, selector).click();
  }
}
