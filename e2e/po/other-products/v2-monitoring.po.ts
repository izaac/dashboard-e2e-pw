import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ResourceTablePo from '@/e2e/po/components/resource-table.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import NameNsDescriptionPo from '@/e2e/po/components/name-ns-description.po';
import CodeMirrorPo from '@/e2e/po/components/code-mirror.po';
import ResourceListMastheadPo from '@/e2e/po/components/resource-list-masthead.po';

/**
 * Page object for the V2 monitoring product page (`/c/<cluster>/monitoring`).
 * Covers AlertmanagerConfig edit + PrometheusRule create flows used by
 * `e2e/tests/pages/charts/v2-monitoring.spec.ts`. Mirrors upstream cypress
 * `cypress/e2e/po/other-products/v2-monitoring.po.ts`.
 */
export default class V2MonitoringPagePo extends PagePo {
  constructor(page: Page, clusterId = 'local') {
    super(page, `/c/${clusterId}/monitoring`);
  }

  list(): ResourceTablePo {
    return new ResourceTablePo(this.page, '[data-testid="sortable-table-list-container"]');
  }

  masthead(): ResourceListMastheadPo {
    return new ResourceListMastheadPo(this.page, ':scope', this.self());
  }

  createButton(): Locator {
    return this.masthead().createButton();
  }

  async editV2MonitoringItem(name: string): Promise<void> {
    const sortableTable = this.list().sortableTable();
    const menu = await sortableTable.rowActionMenuOpen(name);

    await menu.getMenuItem('Edit Config').click();
  }

  alertManagerConfigAddReceiver(): Locator {
    return this.page.getByTestId('v2-monitoring-add-receiver');
  }

  pagerDutyTab(): Locator {
    return this.page.locator('a[href="#pagerduty"], li#pagerduty a').first();
  }

  groupTab(index: number): Locator {
    return this.page.locator(`a[href="#group-${index}"], li#group-${index} a`).first();
  }

  // The receiver list panel renders one `array-list-button` per provider tab
  // (Slack/Email/PagerDuty/...). The testid is shared, so disambiguate by
  // aria-label to pick the right one.
  addPagerDutyReceiver(): Locator {
    return this.page.locator('[data-testid="array-list-button"][aria-label="Add PagerDuty"]');
  }

  receiverName(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="v2-monitoring-receiver-name"]');
  }

  proxyUrl(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="v2-monitoring-receiver-pagerduty-proxy-url"]');
  }

  nameNsDescription(): NameNsDescriptionPo {
    return new NameNsDescriptionPo(this.page, ':scope', this.self());
  }

  prometheusRuleGroupName(index: number): LabeledInputPo {
    return new LabeledInputPo(this.page, `[data-testid="v2-monitoring-prom-rules-group-name-${index}"]`);
  }

  // The "Override Group Interval" testid is placed directly on the <input> element
  // by the monitoring extension UI, not on a unit-input wrapper. Use LabeledInputPo
  // (which assumes testid-on-input) instead of UnitInputPo (which expects a
  // wrapper with a child input).
  prometheusRuleGroupInterval(index: number): LabeledInputPo {
    return new LabeledInputPo(this.page, `[data-testid="v2-monitoring-prom-rules-group-interval-${index}"]`);
  }

  newPrometheusRuleAddBtn(): Locator {
    return this.page.getByTestId('tab-list-add');
  }

  prometheusRulesAddRecord(index: number): Locator {
    return this.page.locator(`[id=group-${index}] [data-testid="v2-monitoring-add-record"]`);
  }

  prometheusRulesRecordName(index: number): LabeledInputPo {
    return new LabeledInputPo(this.page, `[id=group-${index}] [data-testid="v2-monitoring-prom-rules-recording-name"]`);
  }

  prometheusRulesRecordPromQl(index: number): CodeMirrorPo {
    return new CodeMirrorPo(
      this.page,
      `[id=group-${index}] [data-testid="v2-monitoring-prom-rules-recording-promql"] .CodeMirror`,
    );
  }

  prometheusRulesAddAlert(index: number): Locator {
    return this.page.locator(`[id=group-${index}] [data-testid="v2-monitoring-add-alert"]`);
  }

  prometheusRulesAlertName(index: number): LabeledInputPo {
    return new LabeledInputPo(this.page, `[id=group-${index}] [data-testid="v2-monitoring-alerting-rules-alert-name"]`);
  }

  prometheusRulesAlertPromQl(index: number): CodeMirrorPo {
    return new CodeMirrorPo(
      this.page,
      `[id=group-${index}] [data-testid="v2-monitoring-alerting-rules-promql"] .CodeMirror`,
    );
  }

  alertingRuleSeveritySelect(index: number): LabeledSelectPo {
    return new LabeledSelectPo(this.page, `[id=group-${index}] [data-testid="v2-monitoring-alerting-rules-severity"]`);
  }

  saveCreateForm(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="form-save"]', this.self());
  }
}
