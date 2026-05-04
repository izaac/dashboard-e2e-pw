import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class BannersPo extends ComponentPo {
  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  banner(): Locator {
    return this.self().getByTestId('banner-content');
  }

  bannerElement(element: string): Locator {
    return this.self().getByTestId('banner-content').locator(element);
  }

  closeButton(): Locator {
    return this.self().getByTestId('banner-close');
  }
}
