import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import BannersPo from '@/e2e/po/components/banners.po';

export default class AzureCloudCredentialsCreateEditPo extends PagePo {
  private static createPath(clusterId: string, id?: string): string {
    const root = `/c/${clusterId}/manager/cloudCredential`;

    return id ? `${root}/${id}` : `${root}/create`;
  }

  constructor(page: Page, clusterId = '_', id?: string) {
    super(page, AzureCloudCredentialsCreateEditPo.createPath(clusterId, id));
  }

  nameNsDescription(): NameNsDescriptionPo {
    return new NameNsDescriptionPo(this.page, ':scope', this.self());
  }

  environment(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '.vs__dropdown-toggle', this.self());
  }

  subscriptionId(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Subscription ID');
  }

  clientId(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Client ID');
  }

  clientSecret(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Client Secret');
  }

  saveCreateForm(): ResourceDetailPo {
    return new ResourceDetailPo(this.page, ':scope', this.self());
  }

  saveButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="form-save"]', this.self());
  }

  errorBanner(): BannersPo {
    return new BannersPo(this.page, '.banner.error', this.self());
  }
}
