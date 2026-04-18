import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import BannersPo from '@/e2e/po/components/banners.po';

export default class DeactivateDriverDialogPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '[data-testid="prompt-deactivate"]');
  }

  errorBannerContent(label: string): Locator {
    const banners = new BannersPo(this.page, '[data-testid="deactivate-driver-error-banner"]', this.self());

    return banners.banner().filter({ hasText: label });
  }

  async deactivate(): Promise<void> {
    await this.page.getByTestId('deactivate-driver-confirm').click();
  }

  async cancel(): Promise<void> {
    await this.self().locator('.role-secondary').click();
  }
}
