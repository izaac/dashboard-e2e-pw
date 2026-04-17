import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';

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

  /** Dropdown menu options list (visible when a select is open) */
  dropdownOptions(): Locator {
    return this.page.locator('.vs__dropdown-menu > li');
  }

  /** Click a dropdown option by its 1-based index */
  dropdownOptionByIndex(index: number): Locator {
    return this.page.locator(`.vs__dropdown-menu .vs__dropdown-option:nth-child(${index})`);
  }
}
