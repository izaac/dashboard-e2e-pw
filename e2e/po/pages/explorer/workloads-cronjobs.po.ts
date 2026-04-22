import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';

export class WorkloadsCronJobsListPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/batch.cronjob`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, WorkloadsCronJobsListPagePo.createPath(clusterId));
  }

  baseResourceList(): BaseResourceList {
    return new BaseResourceList(this.page, '.dashboard-root');
  }

  async runNow(name: string): Promise<void> {
    const sortableTable = this.baseResourceList().resourceTable().sortableTable();
    const actionMenu = await sortableTable.rowActionMenuOpen(name);

    await actionMenu.getMenuItem('Run Now').click();
  }
}

export class WorkloadsCronJobDetailPagePo extends PagePo {
  private static createPath(cronJobId: string, clusterId: string, namespaceId: string) {
    return `/c/${clusterId}/explorer/batch.cronjob/${namespaceId}/${cronJobId}`;
  }

  constructor(page: Page, cronJobId: string, clusterId = 'local', namespaceId = 'default') {
    super(page, WorkloadsCronJobDetailPagePo.createPath(cronJobId, clusterId, namespaceId));
  }
}
