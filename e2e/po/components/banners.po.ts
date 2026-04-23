import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class BannersPo extends ComponentPo {
  private static readonly HEADER_BANNER = 'header > .banner';

  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  static headerBanners(page: Page): BannersPo {
    return new BannersPo(page, BannersPo.HEADER_BANNER);
  }

  banner(): Locator {
    return this.self().getByTestId('banner-content');
  }

  bannerElement(element: string): Locator {
    return this.self().getByTestId('banner-content').locator(element);
  }

  async closeButton(): Promise<void> {
    await this.self().getByTestId('banner-close').click({ force: true });
  }
}
