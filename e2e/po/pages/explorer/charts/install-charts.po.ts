import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';

import RadioGroupInputPo from '@/e2e/po/components/radio-group-input.po';

export class InstallChartPage extends PagePo {
  constructor(page: Page, clusterId = 'local') {
    super(page, `/c/${clusterId}/apps/charts/install`);
  }

  async waitForChartPage(repository: string, chart: string): Promise<void> {
    await this.waitForPage(`repo-type=cluster&repo=${repository}&chart=${chart}`);
  }

  async nextPage(): Promise<void> {
    const btn = new AsyncButtonPo(this.page, '.controls-steps .btn.role-primary');

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
    await options.clickTabWithSelector(selector);
  }

  async selectTab(options: TabbedPo, tabID: string): Promise<void> {
    await this.editOptions(options, `[data-testid="btn-${tabID}"]`);
  }

  chartName(): Locator {
    return this.self().getByTestId('NameNsDescriptionNameInput');
  }

  /** NameNsDescription component for chart install */
  nameNsDescription(): NameNsDescriptionPo {
    return new NameNsDescriptionPo(this.page, '.dashboard-root');
  }

  /** Select a namespace option by name in the chart install namespace dropdown */
  async selectNamespaceOption(name: string): Promise<void> {
    const nsSelect = this.nameNsDescription().namespace();

    await nsSelect.toggle();
    await nsSelect.filterByName(name);
    await this.page.locator('.vs__dropdown-menu > li').getByText(name, { exact: true }).click();
  }

  chartVersionSelector(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="chart-version-selector"]');
  }

  customRegistryCheckbox(): CheckboxInputPo {
    return new CheckboxInputPo(this.page, '[data-testid="custom-registry-checkbox"]');
  }

  customRegistryInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="custom-registry-input"]');
  }

  /** TabbedPo scoped to the install wizard's tabbed block */
  installTabs(): TabbedPo {
    return new TabbedPo(this.page, '[data-testid="tabbed-block"]');
  }

  /** LabeledSelectPo for a question section's search input */
  questionSectionSelect(sectionName: string): LabeledSelectPo {
    return new LabeledSelectPo(this.page, `section[id="${sectionName}"] [type="search"]`);
  }

  /** Select namespace if the selector is visible (some charts use fixed namespaces) */
  async selectNamespaceIfVisible(name: string): Promise<void> {
    const nsSelect = this.nameNsDescription().namespace();
    const visible = await nsSelect.self().isVisible();

    if (visible) {
      await this.selectNamespaceOption(name);
    }
  }

  /** Storage options radio group for a chart (e.g. rancher-backup) */
  chartStorageOptions(chartSelector: string): RadioGroupInputPo {
    return new RadioGroupInputPo(this.page, `[chart="${chartSelector}"]`);
  }

  /** Storage class select for backup chart */
  backupStorageClassSelect(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="backup-chart-select-existing-storage-class"]');
  }

  /** Switch to Edit Options view (first tab button) */
  async editOptionsView(): Promise<void> {
    const tabbedOptions = new TabbedPo(this.page);

    await tabbedOptions.clickTabWithSelector('[data-testid="button-group-child-0"]');
  }

  /** The wizard footer controls container */
  wizardFooter(): Locator {
    return this.page.locator('#wizard-footer-controls');
  }

  /** Tabs shown on the install questions (Edit Options) screen */
  tabsCountOnInstallQuestions(): Locator {
    return this.self().locator('.tabs [data-testid^="btn-"]');
  }
}
