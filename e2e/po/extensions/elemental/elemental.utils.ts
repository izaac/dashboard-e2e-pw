import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import ExtensionsCompatibilityUtils from '@/e2e/po/extensions/extensions-compatibility.utils';
import BannersPo from '@/e2e/po/components/banners.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import RadioGroupInputPo from '@/e2e/po/components/radio-group-input.po';
import PagePo from '@/e2e/po/pages/page.po';
import ProductNavPo from '@/e2e/po/components/product-nav.po';

class DashboardPagePo extends PagePo {
  constructor(page: Page) {
    super(page, '/elemental/c/_/dashboard');
  }

  mainTitle(): Locator {
    return this.page.getByTestId('elemental-main-title');
  }

  async waitForTitle(): Promise<void> {
    await expect(this.mainTitle()).toContainText('OS Management');
  }

  /** The install operator button locator */
  chartsInstallButton(): Locator {
    return this.self().getByTestId('charts-install-button');
  }

  async installOperator(): Promise<void> {
    await this.chartsInstallButton().click();
  }

  async createElementalCluster(): Promise<void> {
    await this.self().getByTestId('button-create-elemental-cluster').click();
  }

  async createUpdateGroupClick(): Promise<void> {
    await this.self().getByTestId('create-update-group-btn').click();
  }

  productNav(): ProductNavPo {
    return new ProductNavPo(this.page);
  }
}

export default class ElementalPo extends ExtensionsCompatibilityUtils {
  constructor(page: Page) {
    super(page);
  }

  dashboard(): DashboardPagePo {
    return new DashboardPagePo(this.page);
  }

  elementalClusterSelectorTemplateBanner(): BannersPo {
    return new BannersPo(this.page, '[provider="machineinventoryselectortemplate"] .banner.warning');
  }

  updateGroupTargetClustersSelect(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="cluster-target"]');
  }

  updateGroupImageOption(): RadioGroupInputPo {
    return new RadioGroupInputPo(this.page, '[data-testid="upgrade-choice-selector"]');
  }

  rke2CreateSaveButton(): Locator {
    return this.page.getByTestId('rke2-custom-create-save');
  }

  imagePathInput(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.page.locator('.dashboard-root'), 'Image path');
  }
}
