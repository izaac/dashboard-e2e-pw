import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';

export class StorageClassesPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/storage.k8s.io.storageclass`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, StorageClassesPagePo.createPath(clusterId));
  }

  list(): BaseResourceList {
    return new BaseResourceList(this.page, '.dashboard-root');
  }

  async clickCreate(): Promise<void> {
    await this.list().masthead().create();
  }

  createStorageClassesForm(): StorageClassesCreateEditPo {
    return new StorageClassesCreateEditPo(this.page);
  }
}

class StorageClassesCreateEditPo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer/storage.k8s.io.storageclass/create`;
  }

  constructor(page: Page, clusterId = 'local') {
    super(page, StorageClassesCreateEditPo.createPath(clusterId));
  }
}
