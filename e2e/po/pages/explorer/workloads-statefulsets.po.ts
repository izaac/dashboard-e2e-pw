import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';

export class WorkloadsStatefulSetsListPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/apps.statefulset`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, WorkloadsStatefulSetsListPagePo.createPath(clusterId));
  }

  redeployDialog(): Locator {
    return this.page
      .getByTestId('redeploy-dialog')
      .or(this.page.locator('.prompt-modal'))
      .or(this.page.getByRole('alertdialog').filter({ hasText: 'Redeploy' }));
  }
}
