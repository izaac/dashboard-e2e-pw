import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';

export default class GKECloudCredentialsCreateEditPo extends PagePo {
  private static createPath(clusterId: string, id?: string): string {
    const root = `/c/${clusterId}/manager/cloudCredential`;

    return id ? `${root}/${id}` : `${root}/create`;
  }

  constructor(page: Page, clusterId = '_', id?: string) {
    super(page, GKECloudCredentialsCreateEditPo.createPath(clusterId, id));
  }

  nameNsDescription(): NameNsDescriptionPo {
    return new NameNsDescriptionPo(this.page, ':scope', this.self());
  }

  serviceAccount(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Service Account');
  }

  authenticateButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="action-button-async-button"]', this.self());
  }

  saveCreateForm(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  saveButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="form-save"]', this.self());
  }
}
