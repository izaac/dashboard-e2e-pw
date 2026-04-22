import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ButtonGroupPo from '@/e2e/po/components/button-group.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import RadioGroupInputPo from '@/e2e/po/components/radio-group-input.po';

export default class PreferencesPagePo extends PagePo {
  static url = '/prefs';

  constructor(page: Page) {
    super(page, PreferencesPagePo.url);
  }

  /** The h1 title on the preferences page */
  title(): Locator {
    return this.page.locator('h1');
  }

  /** Theme options container */
  themeOptions(): Locator {
    return this.page.getByTestId('prefs__themeOptions');
  }

  /** Theme button group (Light / Dark) */
  themeButtons(): ButtonGroupPo {
    return new ButtonGroupPo(this.page, '[data-testid="prefs__themeOptions"]');
  }

  languageDropdownMenu(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="prefs__languageSelector"]');
  }

  dateFormateDropdownMenu(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="prefs__displaySetting__dateFormat"]');
  }

  timeFormateDropdownMenu(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="prefs__displaySetting__timeFormat"]');
  }

  perPageDropdownMenu(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="prefs__displaySetting__perPage"]');
  }

  clustersDropdownMenu(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="prefs__displaySetting__menuMaxClusters"]');
  }

  keymapButtons(): ButtonGroupPo {
    return new ButtonGroupPo(this.page, '[data-testid="prefs__keymapOptions"]');
  }

  helmButtons(): ButtonGroupPo {
    return new ButtonGroupPo(this.page, '[data-testid="prefs__helmOptions"]');
  }

  hideDescriptionsCheckbox(): CheckboxInputPo {
    return new CheckboxInputPo(this.page, '[data-testid="prefs__hideDescriptions"]');
  }

  async verifyHideDescriptionsCheckboxLabel(): Promise<void> {
    const label = await this.hideDescriptionsCheckbox().getCheckboxLabel();
    const { expect } = await import('@playwright/test');

    expect(label).toBe('Hide Type Description banners above resource lists ');
  }

  landingPageRadioBtn(): RadioGroupInputPo {
    return new RadioGroupInputPo(this.page, '[data-testid="prefs__landingPagePreference"]');
  }

  customPageOptionsDropdown(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '.custom-page-options');
  }

  /** Date format select dropdown */
  dateFormatSelect(): Locator {
    return this.page.getByTestId('prefs__displaySetting__dateFormat');
  }

  /** Time format select dropdown */
  timeFormatSelect(): Locator {
    return this.page.getByTestId('prefs__displaySetting__timeFormat');
  }

  /** Per-page select dropdown */
  perPageSelect(): Locator {
    return this.page.getByTestId('prefs__displaySetting__perPage');
  }

  /** Scaling down prompt checkbox */
  scalingDownPromptCheckbox(): Locator {
    return this.page.getByTestId('prefs__scalingDownPrompt');
  }

  /** View in API checkbox */
  viewInApiCheckbox(): Locator {
    return this.page.getByTestId('prefs__viewInApi');
  }

  /** All namespaces checkbox */
  allNamespacesCheckbox(): Locator {
    return this.page.getByTestId('prefs__allNamespaces');
  }

  /** Theme shortcut checkbox */
  themeShortcutCheckbox(): Locator {
    return this.page.getByTestId('prefs__themeShortcut');
  }

  /** YAML editor keymap options container */
  keymapOptions(): Locator {
    return this.page.getByTestId('prefs__keymapOptions');
  }

  /** Helm chart options container */
  helmOptions(): Locator {
    return this.page.getByTestId('prefs__helmOptions');
  }

  /** Landing page preference radio group */
  landingPagePreference(): Locator {
    return this.page.getByTestId('prefs__landingPagePreference');
  }

  /** Custom page options section (cluster dropdown for specific cluster landing) */
  customPageOptions(): Locator {
    return this.page.locator('.custom-page-options');
  }

  async expectThemeOptionSelected(theme = 'auto'): Promise<void> {
    const { expect } = await import('@playwright/test');
    const btn = this.themeButtons().self().locator(`button:has-text("${theme}")`);

    await expect(btn).toHaveClass(/selected|active/);
  }

  async expectClusterOptionExists(clusterName = 'local'): Promise<void> {
    const { expect } = await import('@playwright/test');

    await expect(this.customPageOptionsDropdown().self()).toContainText(clusterName);
  }

  async checkLangDomElement(label: string): Promise<void> {
    const { expect } = await import('@playwright/test');

    await expect(this.page.locator(label)).toBeAttached();
  }

  /** Dropdown menu options list (visible when a select is open) */
  dropdownOptions(): Locator {
    return this.page.locator('.vs__dropdown-menu > li');
  }

  /** Click a dropdown option by its 1-based index */
  dropdownOptionByIndex(index: number): Locator {
    return this.page.locator(`.vs__dropdown-menu .vs__dropdown-option:nth-child(${index})`);
  }

  /** YAML editor keyboard mapping indicator (visible when a non-default keymap is active) */
  keyboardMappingIndicator(): Locator {
    return this.page.locator('.keyboard-mapping-indicator');
  }
}
