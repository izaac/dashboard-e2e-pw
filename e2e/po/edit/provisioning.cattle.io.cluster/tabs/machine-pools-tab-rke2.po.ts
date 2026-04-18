import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';

export default class MachinePoolRke2 extends ComponentPo {
  constructor(page: Page, parent?: Locator) {
    super(page, '.dashboard-root', parent);
  }

  poolName(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="machine-pool-name-input"]');
  }

  poolQuantity(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="machine-pool-quantity-input"]');
  }

  networks(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="amazonEc2__selectedNetwork"]');
  }

  enableDualStack(): CheckboxInputPo {
    return new CheckboxInputPo(this.page, '[data-testid="amazonEc2__enableIpv6"]');
  }

  enableIpv6(): CheckboxInputPo {
    return new CheckboxInputPo(this.page, '[data-testid="amazonEc2__ipv6AddressOnly"]');
  }
}
