import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import CodeMirrorPo from '@/e2e/po/components/code-mirror.po';
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

  /** Wizard footer Next button (accepts both legacy and rc-button primary classes) */
  nextButton(): Locator {
    return this.page.locator('.controls-steps .btn.role-primary, .controls-steps .btn.variant-primary');
  }

  /** Wizard footer install (finish) button, only present on the last step */
  installButton(): Locator {
    return this.page.locator('.controls-steps [data-testid="action-button-async-button"]');
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

  /** Chart values "defaults" CodeMirror editor (CM6-aware) */
  defaultsEditor(): CodeMirrorPo {
    return new CodeMirrorPo(this.page, '[data-testid="chart-values-defaults-code-mirror"]');
  }

  /** Chart values "overrides" CodeMirror editor (CM6-aware) */
  overridesEditor(): CodeMirrorPo {
    return new CodeMirrorPo(this.page, '[data-testid="chart-values-overrides-code-mirror"]');
  }

  defaultsEditorContent(): Locator {
    return this.page.locator('[data-testid="chart-values-defaults-code-mirror"] .cm-content');
  }

  overridesPane(): Locator {
    return this.page.locator('[data-testid="chart-values-overrides-pane"]');
  }

  defaultsPane(): Locator {
    return this.page.locator('[data-testid="chart-values-defaults-pane"]');
  }

  /** Click "Compare Changes" in the YAML view toggle group */
  async compareChanges(): Promise<void> {
    await this.self().getByTestId('btn-group-options-view').getByText('Compare Changes').click();
  }

  diffView(): Locator {
    return this.page.locator('#diffElement');
  }

  /** Added lines (`.d2h-ins .d2h-code-line-ctn`, the code cell, not the line-number cell) in the Compare Changes diff */
  diffAddedLines(): Locator {
    return this.diffView().locator('.d2h-ins .d2h-code-line-ctn');
  }

  /** Removed lines (`.d2h-del .d2h-code-line-ctn`, the code cell, not the line-number cell) in the Compare Changes diff */
  diffRemovedLines(): Locator {
    return this.diffView().locator('.d2h-del .d2h-code-line-ctn');
  }

  /** Unchanged context lines (`.d2h-cntx .d2h-code-line-ctn`, the code cell) in the Compare Changes diff */
  diffContextLines(): Locator {
    return this.diffView().locator('.d2h-cntx .d2h-code-line-ctn');
  }

  /** Choose "Create a New Namespace" in the namespace dropdown and type the new name */
  async createNamespaceOption(name: string): Promise<void> {
    const nsSelect = this.nameNsDescription().namespace();

    await nsSelect.dropdown().click();
    await nsSelect.clickOptionWithLabel('Create a New Namespace');
    await nsSelect.self().locator('.create-input input').fill(name);
  }

  errorBanner(): Locator {
    return this.page.locator('[role=alert].footer-error');
  }

  /** Banner shown when values from a previous version are applied on top of a new one */
  upgradeBanner(): Locator {
    return this.page.locator('.description').filter({ hasText: 'Your values from' });
  }
}
