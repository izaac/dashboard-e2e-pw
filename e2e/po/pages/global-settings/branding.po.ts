import type { Page } from '@playwright/test';
import RootClusterPage from '@/e2e/po/pages/root-cluster-page.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';

export class BrandingPagePo extends RootClusterPage {
  static url = '/c/_/settings/brand';

  constructor(page: Page) {
    super(page, BrandingPagePo.url);
  }

  privateLabel(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Private Label');
  }

  saveButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="branding-apply-async-button"]');
  }
}
