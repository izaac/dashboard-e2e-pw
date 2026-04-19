import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';

export class WorkloadsStatefulSetsListPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/apps.statefulset`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, WorkloadsStatefulSetsListPagePo.createPath(clusterId));
  }

  sortableTable(): SortableTablePo {
    return new SortableTablePo(this.page, '.sortable-table');
  }

  redeployDialog(): Locator {
    return this.page
      .getByTestId('redeploy-dialog')
      .or(this.page.locator('.prompt-modal'))
      .or(this.page.getByRole('alertdialog').filter({ hasText: 'Redeploy' }));
  }

  redeployDialogConfirmButton(): Locator {
    return this.redeployDialog().locator('button').filter({ hasText: 'Redeploy' });
  }

  redeployDialogCancelButton(): Locator {
    return this.redeployDialog().locator('button').filter({ hasText: 'Cancel' });
  }

  redeployDialogErrorBanner(): Locator {
    return this.redeployDialog().locator('.banner.error');
  }
}
