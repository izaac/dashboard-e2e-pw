import type { Locator, Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import ResourceDetailPo from '@/e2e/po/edit/resource-detail.po';
import CruResourcePo from '@/e2e/po/components/cru-resource.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import BannersPo from '@/e2e/po/components/banners.po';

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

  /**
   * When hide-sensitive pref is on (default), edit/clone pages show a Key-Value form
   * instead of LabeledInput fields. Row order for Amazon EC2: accessKey=0, defaultRegion=1, secretKey=2.
   */
  kvValueByIndex(rowIndex: number): Locator {
    return this.self().getByTestId(`kv-item-value-${rowIndex}`).locator('[data-testid="value-multiline"]');
  }

  defaultRegion(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '.v-select', this.self());
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
