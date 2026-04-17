import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';

export default class DigitalOceanCloudCredentialsCreateEditPo extends PagePo {
  constructor(page: Page, clusterId = '_') {
    super(page, `/c/${clusterId}/manager/cloudCredential/create`);
  }

  credentialName(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Credential Name');
  }

  accessToken(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Access Token');
  }

  saveCreateForm(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }
}
