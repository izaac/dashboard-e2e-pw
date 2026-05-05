import type { Page, Locator } from '@playwright/test';
import RootClusterPage from '@/e2e/po/pages/root-cluster-page.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import ColorInputPo from '@/e2e/po/components/color-input.po';

export class BrandingPagePo extends RootClusterPage {
  static url = '/c/_/settings/brand';

  constructor(page: Page) {
    super(page, BrandingPagePo.url);
  }

  privateLabel(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Private Label');
  }

  supportLinksLabel(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Issue Reporting URL');
  }

  customLogoCheckbox(): CheckboxInputPo {
    return CheckboxInputPo.byLabel(this.page, this.self(), 'Use a Custom Logo');
  }

  customBannerCheckbox(): CheckboxInputPo {
    return CheckboxInputPo.byLabel(this.page, this.self(), 'Use a Custom Banner');
  }

  customLoginBackgroundCheckbox(): CheckboxInputPo {
    return CheckboxInputPo.byLabel(this.page, this.self(), 'Use a Custom Background');
  }

  customFaviconCheckbox(): CheckboxInputPo {
    return CheckboxInputPo.byLabel(this.page, this.self(), 'Use a Custom Favicon');
  }

  primaryColorCheckbox(): CheckboxInputPo {
    return CheckboxInputPo.byLabel(this.page, this.self(), 'Use a Custom Color');
  }

  primaryColorPicker(): ColorInputPo {
    return new ColorInputPo(this.page, '[data-testid="primary-color-input"]');
  }

  linkColorCheckbox(): CheckboxInputPo {
    return CheckboxInputPo.byLabel(this.page, this.self(), 'Use a Custom Link Color');
  }

  linkColorPicker(): ColorInputPo {
    return new ColorInputPo(this.page, '[data-testid="link-color-input"]');
  }

  /** File upload input for a given label (e.g. "Upload Light Logo") */
  uploadButton(label: string): Locator {
    // The hidden <input type="file"> is inside the button element
    return this.page
      .getByTestId('file-selector__uploader-button')
      .filter({ hasText: label })
      .locator('input[type="file"]');
  }

  logoPreview(theme: string): Locator {
    return this.page.getByTestId(`branding-logo-${theme}-preview`);
  }

  bannerPreview(theme: string): Locator {
    return this.page.getByTestId(`branding-banner-${theme}-preview`);
  }

  loginBackgroundPreview(theme: string): Locator {
    return this.page.getByTestId(`branding-login-background-${theme}-preview`);
  }

  faviconPreview(): Locator {
    return this.page.getByTestId('branding-favicon-preview');
  }

  applyButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="branding-apply-async-button"]');
  }

  saveButton(): AsyncButtonPo {
    return this.applyButton();
  }

  /** Click Apply; returns the PUT `Response` so callers can assert. */
  async applyAndWait(endpoint: string): Promise<import('@playwright/test').Response> {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes(endpoint) && resp.request().method() === 'PUT',
    );

    await this.applyButton().click();

    return responsePromise;
  }
}
