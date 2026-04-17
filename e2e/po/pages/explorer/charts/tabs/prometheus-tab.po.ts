import type { Page, Locator } from '@playwright/test';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import { MonitoringTab } from '@/e2e/po/pages/explorer/charts/tabs/monitoring-tab.po';

export class PrometheusTab extends MonitoringTab {
  constructor(page: Page, selector = '.dashboard-root', parent?: Locator) {
    super(page, selector, parent);
  }

  tabID(): string {
    return 'prometheus';
  }

  persistentStorage(): CheckboxInputPo {
    return new CheckboxInputPo(this.page, '[data-testid="checkbox-chart-enable-persistent-storage"]');
  }

  storageClass(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="select-chart-prometheus-storage-class"]');
  }
}
