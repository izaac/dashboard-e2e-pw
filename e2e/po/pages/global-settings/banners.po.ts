import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import RootClusterPage from '@/e2e/po/pages/root-cluster-page.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import RadioGroupInputPo from '@/e2e/po/components/radio-group-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import ColorInputPo from '@/e2e/po/components/color-input.po';
import ToggleSwitchPo from '@/e2e/po/components/toggle-switch.po';

/**
 * Lightweight checkbox wrapper for banner checkboxes found by label text.
 */
export class BannerCheckboxPo {
  private container: Locator;

  constructor(container: Locator) {
    this.container = container;
  }

  self(): Locator {
    return this.container;
  }

  async set(): Promise<void> {
    const checkbox = this.container.locator('span.checkbox-custom');

    await checkbox.scrollIntoViewIfNeeded();
    await checkbox.click({ timeout: 10000 });
  }

  async ensureChecked(): Promise<void> {
    const ariaChecked = await this.container.locator('span.checkbox-custom').getAttribute('aria-checked');

    if (ariaChecked !== 'true') {
      await this.set();
    }

    await this.isChecked();
  }

  async isChecked(): Promise<void> {
    await expect(this.container.locator('span.checkbox-custom')).toHaveAttribute('aria-checked', 'true');
  }

  async checkVisible(): Promise<void> {
    await this.container.scrollIntoViewIfNeeded();
    await expect(this.container).toBeVisible();
  }

  async isDisabled(): Promise<void> {
    await expect(this.container.locator('span.checkbox-custom')).toHaveAttribute('aria-disabled', 'true');
  }

  async hasAppropriateWidth(): Promise<void> {
    const width = await this.container.locator('span.checkbox-custom').evaluate((el) => getComputedStyle(el).width);

    expect(width).toMatch(/14.*px/);
  }

  async hasAppropriateHeight(): Promise<void> {
    const height = await this.container.locator('span.checkbox-custom').evaluate((el) => getComputedStyle(el).height);

    expect(height).toMatch(/14.*px/);
  }
}

export class BannersPagePo extends RootClusterPage {
  static url = '/c/_/settings/banners';

  constructor(page: Page) {
    super(page, BannersPagePo.url);
  }

  // --- Checkboxes ---

  headerBannerCheckbox(): BannerCheckboxPo {
    return new BannerCheckboxPo(
      this.self().locator('.checkbox-outer-container').filter({ hasText: 'Show Banner in Header' }),
    );
  }

  footerBannerCheckbox(): BannerCheckboxPo {
    return new BannerCheckboxPo(
      this.self().locator('.checkbox-outer-container').filter({ hasText: 'Show Banner in Footer' }),
    );
  }

  loginScreenBannerCheckbox(): BannerCheckboxPo {
    return new BannerCheckboxPo(
      this.self().locator('.checkbox-outer-container').filter({ hasText: 'Show Consent Banner on Login Screen' }),
    );
  }

  loginErrorCheckbox(): BannerCheckboxPo {
    return new BannerCheckboxPo(
      this.self().locator('.checkbox-outer-container').filter({ hasText: 'Show custom login error' }),
    );
  }

  consentBannerShowAsDialogCheckbox(): BannerCheckboxPo {
    return new BannerCheckboxPo(this.self().locator('[data-testid="banner_show_as_dialog_checkboxbannerConsent"]'));
  }

  // --- Text inputs ---

  headerTextArea(): Locator {
    return this.page.locator('[data-testid="text-area-auto-grow"][aria-describedby*="bannerHeader"]');
  }

  footerTextArea(): Locator {
    return this.page.locator('[data-testid="text-area-auto-grow"][aria-describedby*="bannerFooter"]');
  }

  loginScreenTextArea(): Locator {
    return this.page.locator('[data-testid="text-area-auto-grow"][aria-describedby*="bannerConsent"]');
  }

  loginErrorInput(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Text to display');
  }

  // --- Formatting controls ---

  textAlignmentRadioGroup(bannerType: string): RadioGroupInputPo {
    return new RadioGroupInputPo(this.page, `[data-testid="banner_alignment_radio_options${bannerType}"]`, this.self());
  }

  textDecorationCheckbox(bannerType: string, label: string): BannerCheckboxPo {
    return new BannerCheckboxPo(this.self().locator(`[data-testid="banner_decoration_checkbox${bannerType}${label}"]`));
  }

  async selectFontSizeByValue(bannerType: string, label: string): Promise<void> {
    const select = new LabeledSelectPo(this.page, `[data-testid="banner_font_size_options${bannerType}"]`, this.self());

    await select.dropdown().click();
    await select.clickOptionWithLabel(label);
  }

  // --- Color pickers ---

  textColorPicker(index: number): ColorInputPo {
    return new ColorInputPo(this.page, `[data-testid="color-input-color-input"] >> nth=${index}`);
  }

  // --- Content type ---

  contentTypeToggle(bannerType: string): ToggleSwitchPo {
    return new ToggleSwitchPo(this.page, `[data-testid="banner_content_type_toggle${bannerType}"]`, this.self());
  }

  htmlTextArea(bannerType: string): Locator {
    return this.self().locator(`[data-testid="banner_html${bannerType}"]`);
  }

  acceptButtonInput(bannerType: string): Locator {
    return this.self().locator(`[data-testid="banner_accept_button${bannerType}"]`);
  }

  // --- Buttons ---

  saveButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="action-button-async-button"]');
  }

  async applyAndWait(urlMatch: string, statusCode?: number): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes(urlMatch) && resp.request().method() === 'PUT',
    );

    await this.saveButton().apply();
    const response = await responsePromise;

    if (statusCode !== undefined) {
      expect(response.status()).toBe(statusCode);
    }
  }

  // --- Banner elements (displayed across the app) ---

  /** Generic fixed banner (data-testid="fixed__banner") */
  fixedBanner(): Locator {
    return this.page.getByTestId('fixed__banner');
  }

  /** Inner text div of the fixed banner (for CSS style assertions) */
  fixedBannerTextDiv(): Locator {
    return this.fixedBanner().locator('div').first();
  }

  headerBanner(): Locator {
    return this.page.locator('#banner-header');
  }

  headerBannerContent(): Locator {
    return this.headerBanner().locator('.banner');
  }

  footerBanner(): Locator {
    return this.page.locator('#banner-footer');
  }

  footerBannerContent(): Locator {
    return this.footerBanner().locator('.banner');
  }

  consentBanner(): Locator {
    return this.page.locator('#banner-consent');
  }

  consentBannerContent(): Locator {
    return this.consentBanner().locator('.banner');
  }

  /** Inner text div of the consent banner (for CSS style assertions) */
  consentBannerTextDiv(): Locator {
    return this.consentBannerContent().locator('div').first();
  }

  loginSubmitButton(): Locator {
    return this.page.getByTestId('login-submit');
  }

  /** Find a banner element by its text content */
  bannerByText(text: string): Locator {
    return this.page.getByText(text);
  }

  loginConfirmationDialog(): Locator {
    return this.page.locator('#banner-consent .banner-dialog-frame');
  }

  /** Get the outer HTML of an <img> inside a banner locator (for XSS sanitisation checks) */
  async bannerImgOuterHtml(banner: Locator): Promise<string> {
    return banner.locator('img').evaluate((el) => el.outerHTML);
  }

  /** Paragraph text inside a banner locator */
  bannerParagraph(banner: Locator): Locator {
    return banner.locator('p');
  }
}
