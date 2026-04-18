import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';

export default class NetworkRke2 extends ComponentPo {
  constructor(page: Page, parent?: Locator) {
    super(page, '.dashboard-root', parent);
  }

  clusterCIDR(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="cluster-cidr"]');
  }

  serviceCIDR(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="service-cidr"]');
  }

  stackPreference(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="network-tab-stackpreferences"]');
  }

  flannelMasq(): CheckboxInputPo {
    return new CheckboxInputPo(this.page, '[data-testid="cluster-rke2-flannel-masq-checkbox"]');
  }
}
