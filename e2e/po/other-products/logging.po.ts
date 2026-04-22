import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

/**
 * Page object for Logging chart resources (ClusterOutput, ClusterFlow).
 */
export default class LoggingPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '.dashboard-root');
  }

  /** Masthead create button */
  mastheadCreate(): Locator {
    return this.page.getByTestId('masthead-create');
  }

  /** Name input in the name-ns-description component */
  nameInput(): Locator {
    return this.page.getByTestId('NameNsDescriptionNameInput');
  }

  /** The form save button */
  formSave(): Locator {
    return this.page.getByTestId('form-save');
  }

  /** Output target (URL) input — mirrors upstream Cypress target() which finds input by label "URL" */
  outputTargetInput(): Locator {
    return this.page.getByLabel('URL');
  }

  /** Outputs tab button */
  outputsTab(): Locator {
    return this.page.getByTestId('btn-outputs');
  }

  /** Match tab button */
  matchTab(): Locator {
    return this.page.getByTestId('btn-match');
  }

  /** Flow output selector dropdown — mirrors upstream: section#outputs .labeled-select */
  flowOutputSelector(): Locator {
    return this.page.locator('section#outputs .labeled-select');
  }

  /**
   * Flow namespace selector — the v-select for "Limit to specific namespaces".
   * In the match section, there are 3 v-selects: nodes (0), containers (1), namespaces (2).
   */
  flowNamespaceSelector(): Locator {
    return this.page.locator('section#match .v-select').nth(2);
  }

  /** Namespace selector in the match section — the last unlabeled-select (after nodes/containers) */
  matchNamespaceSelector(): Locator {
    return this.page.locator('section#match .unlabeled-select').last();
  }

  /** Dropdown menu options (visible when a select is open) */
  dropdownOptions(): Locator {
    return this.page.locator('.vs__dropdown-menu > li');
  }

  /** Table rows */
  tableRows(): Locator {
    return this.page.locator('tbody tr');
  }

  /** Find a table row by text content */
  tableRowByText(text: string): Locator {
    return this.tableRows().filter({ hasText: text });
  }

  /** Click the detail link in a table row */
  rowDetailLink(text: string): Locator {
    return this.tableRowByText(text).locator('td.col-link-detail a');
  }

  /** Flow rule item by index — mirrors upstream ArrayListPo.arrayListItem (matches both create and detail views) */
  flowRuleItem(index: number): Locator {
    return this.page
      .locator('.array-list-grouped')
      .locator('.array-list-item, [data-testid^="array-list-box"]')
      .nth(index);
  }
}
