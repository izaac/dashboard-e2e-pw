import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import RadioGroupInputPo from '@/e2e/po/components/radio-group-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';

export class GrafanaTab extends ComponentPo {
  constructor(page: Page, selector = '.dashboard-root', parent?: Locator) {
    super(page, selector, parent);
  }

  tabID(): string {
    return 'grafana';
  }

  requestedCpu(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="input-grafana-requests-cpu"]');
  }

  requestedMemory(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="input-grafana-requests-memory"]');
  }

  cpuLimit(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="input-grafana-limits-cpu"]');
  }

  memoryLimit(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="input-grafana-limits-memory"]');
  }

  storageOptions(): RadioGroupInputPo {
    return new RadioGroupInputPo(this.page, '[data-testid="radio-group-input-grafana-storage"]');
  }

  storageClass(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="select-chart-grafana-storage-class"]');
  }

  storagePvcSizeInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="grafana-storage-pvc-size"]');
  }

  storageStatefulsetSizeInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="grafana-storage-statefulset-size"]');
  }
}
