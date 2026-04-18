import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';

export default class BasicsRke2 extends ComponentPo {
  constructor(page: Page, parent?: Locator) {
    super(page, '.dashboard-root', parent);
  }

  kubernetesVersions(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="clusterBasics__kubernetesVersions"]');
  }

  networks(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="cluster-rke2-cni-select"]');
  }
}
