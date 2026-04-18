import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';

export default class KontainerDriverCreateEditPo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/manager/kontainerDriver/create`;
  }

  constructor(page: Page, clusterId = '_') {
    super(page, KontainerDriverCreateEditPo.createPath(clusterId));
  }

  downloadUrl(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="driver-create-url-field"]');
  }

  customUiUrl(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="driver-create-uiurl-field"]');
  }

  checksum(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="driver-create-checksum-field"]');
  }

  saveCreateForm(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }
}
