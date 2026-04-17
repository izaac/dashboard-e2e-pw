import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';

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

  chartVersionSelector(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="chart-version-selector"]');
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
