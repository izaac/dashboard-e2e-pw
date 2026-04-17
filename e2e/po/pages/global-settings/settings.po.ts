import type { Page, Locator } from '@playwright/test';
import RootClusterPage from '@/e2e/po/pages/root-cluster-page.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';

export class SettingsPagePo extends RootClusterPage {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/settings/management.cattle.io.setting`;
  }

  constructor(page: Page, clusterId = '_') {
    super(page, SettingsPagePo.createPath(clusterId));
  }

  advancedSettingRow(label: string): Locator {
    return this.page.getByTestId(`advanced-setting__option-${label}`);
  }

  actionButtonByLabel(label: string): Locator {
    return this.advancedSettingRow(label).locator('[data-testid*="action-button"]');
  }

  editSettingsButton(): Locator {
    return this.page.locator('[dropdown-menu-item]').filter({ hasText: 'Edit Setting' });
  }

  /** The h1 title on the setting detail/edit page */
  settingTitle(): Locator {
    return this.page.locator('h1');
  }

  /** The text/number input or textarea on the setting edit page */
  settingInput(): Locator {
    return this.page.locator('main').locator('textarea, input[type="number"], input[type="text"]').first();
  }

  /** The save/apply async button on the setting edit page */
  saveButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="form-save"]');
  }

  /** The "Use Default" button to reset the setting */
  useDefaultButton(): Locator {
    return this.page.getByTestId('advanced_settings_use_default');
  }

  /** Banners in the main content area (settings list warning or edit page validation banners) */
  banner(): Locator {
    return this.page.locator('main .banner');
  }

  /** Server URL localhost warning banner */
  serverUrlLocalhostWarningBanner(): Locator {
    return this.page.getByTestId('setting-serverurl-localhost-warning');
  }

  /** Server URL error banner content */
  errorBanner(): Locator {
    return this.page.getByTestId('setting-error-banner');
  }

  /** The unlabeled select dropdown on the setting edit page */
  unlabeledSelect(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="input-setting-enum"]');
  }

  /** Radio buttons on the setting edit page */
  radioButton(index: number): Locator {
    return this.page.getByTestId('input-setting-boolean').locator('[role="radio"]').nth(index);
  }

  /** Scroll the main layout to the bottom */
  async scrollToBottom(): Promise<void> {
    await this.page.locator('.main-layout').evaluate((el) => el.scrollTo(0, el.scrollHeight));
  }
}
