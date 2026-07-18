import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';

export class InstallChartPage extends PagePo {
  constructor(page: Page, clusterId = 'local') {
    super(page, `/c/${clusterId}/apps/charts/install`);
  }

  async waitForChartPage(repository: string, chart: string): Promise<void> {
    await this.waitForPage(`repo-type=cluster&repo=${repository}&chart=${chart}`);
  }

  async nextPage(): Promise<void> {
    // Wizard footer Next button. Recent rancher dashboard switched the
    // primary button class from `role-primary` to `variant-primary`
    // (rc-button refactor); accept both so we work across versions.
    const btn = new AsyncButtonPo(this.page, '.controls-steps .btn.role-primary, .controls-steps .btn.variant-primary');

    await btn.click(true);
  }

  async installChart(): Promise<void> {
    const btn = new AsyncButtonPo(this.page, '.controls-steps [data-testid="action-button-async-button"]');

    await btn.click(true);
  }

  async editYaml(): Promise<void> {
    await this.self().getByTestId('btn-group-options-view').getByText('Edit YAML').click();
  }

  async editOptions(options: TabbedPo, selector: string): Promise<void> {
    await options.tabBySelector(selector).click();
  }

  async selectTab(options: TabbedPo, tabID: string): Promise<void> {
    await this.editOptions(options, `[data-testid="btn-${tabID}"]`);
  }

  chartName(): Locator {
    return this.self().getByTestId('NameNsDescriptionNameInput');
  }

  chartNameLink(): Locator {
    return this.self().getByTestId('chart-install-name-link');
  }

  /** NameNsDescription component for chart install */
  nameNsDescription(): NameNsDescriptionPo {
    return new NameNsDescriptionPo(this.page, '.dashboard-root');
  }

  /** Select a namespace option by name in the chart install namespace dropdown */
  async selectNamespaceOption(name: string): Promise<void> {
    const nsSelect = this.nameNsDescription().namespace();

    await nsSelect.dropdown().click();
    await nsSelect.searchInput().fill(name);
    await this.page.locator('.vs__dropdown-menu > li').getByText(name, { exact: true }).click();
  }

  chartVersionSelector(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="chart-version-selector"]');
  }

  /**
   * Vue-select for a chart question rendered inside a named questions group tab
   * (e.g. the `throwaway.resource` ConfigMap picker under "Other Demo Fields").
   * Anchors on the vue-select wrapper so the PO's `dropdown()` resolves the
   * combobox role, which vue-select renders on the wrapper, not the search input.
   */
  questionsGroupSelect(groupId: string): LabeledSelectPo {
    return new LabeledSelectPo(this.page, `section[id="${groupId}"] .v-select`);
  }

  customRegistryCheckbox(): CheckboxInputPo {
    return new CheckboxInputPo(this.page, '[data-testid="custom-registry-checkbox"]');
  }

  customRegistryInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="custom-registry-input"]');
  }

  /** The wizard footer controls container */
  wizardFooter(): Locator {
    return this.page.locator('#wizard-footer-controls');
  }
}
