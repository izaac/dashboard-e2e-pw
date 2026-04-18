import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import CruResourcePo from '@/e2e/po/components/cru-resource.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';

export default class CloudCredentialsCreateEditPo extends PagePo {
  private static createPath(clusterId: string, id?: string): string {
    const root = `/c/${clusterId}/manager/cloudCredential`;

    return id ? `${root}/${id}` : `${root}/create`;
  }

  constructor(page: Page, clusterId = '_', id?: string) {
    super(page, CloudCredentialsCreateEditPo.createPath(clusterId, id));
  }

  cloudServiceOptions(): CruResourcePo {
    return new CruResourcePo(this.page, '[data-testid="cru-form"]');
  }

  nameNsDescription(): NameNsDescriptionPo {
    return new NameNsDescriptionPo(this.page, ':scope', this.self());
  }

  accessKey(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Access Key');
  }

  secretKey(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Secret Key');
  }

  defaultRegion(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '.vs__dropdown-toggle', this.self());
  }

  saveCreateForm(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  saveButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="form-save"]', this.self());
  }
}
