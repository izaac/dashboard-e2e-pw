import type { Page, Locator } from '@playwright/test';
import RootClusterPage from '@/e2e/po/pages/root-cluster-page.po';
import ComponentPo from '@/e2e/po/components/component.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';

export class BannersPagePo extends RootClusterPage {
  static url = '/c/_/settings/banners';

  constructor(page: Page) {
    super(page, BannersPagePo.url);
  }

  headerBannerCheckbox(): ComponentPo {
    return new ComponentPo(this.page, '[data-checkbox-ctrl]', this.self().locator('label', { hasText: 'Show Banner in Header' }).locator('..'));
  }

  saveButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="action-button-async-button"]');
  }

  /** The header banner element displayed across the app */
  headerBanner(): Locator {
    return this.page.locator('#banner-header');
  }

  /** The inner styled element of the header banner (carries background-color) */
  headerBannerContent(): Locator {
    return this.headerBanner().locator('.banner');
  }

  /** The footer banner element displayed across the app */
  footerBanner(): Locator {
    return this.page.locator('#banner-footer');
  }

  /** The inner styled element of the footer banner (carries background-color) */
  footerBannerContent(): Locator {
    return this.footerBanner().locator('.banner');
  }

  /** The consent banner element on the login page */
  consentBanner(): Locator {
    return this.page.locator('#banner-consent');
  }

  /** The inner styled element of the consent banner (carries background-color) */
  consentBannerContent(): Locator {
    return this.consentBanner().locator('.banner');
  }

  /** The login submit button */
  loginSubmitButton(): Locator {
    return this.page.getByTestId('login-submit');
  }
}
