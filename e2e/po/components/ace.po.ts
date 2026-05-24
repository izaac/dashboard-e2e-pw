import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import RadioGroupInputPo from '@/e2e/po/components/radio-group-input.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';

/**
 * Authorized Cluster Endpoint (ACE) panel.
 * Ported from upstream cypress/e2e/po/components/ace.po.ts.
 */
export default class ACE extends ComponentPo {
  constructor(page: Page, selector = '.dashboard-root', parent?: Locator) {
    super(page, selector, parent);
  }

  enabledRadio(): RadioGroupInputPo {
    return new RadioGroupInputPo(this.page, '[data-testid="ace-enabled-radio-input"]', this.self());
  }

  async enable(): Promise<void> {
    await this.enabledRadio().set(1);
  }

  fqdn(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'FQDN');
  }

  caCerts(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'CA Certificates');
  }

  async enterFdqn(val: string): Promise<void> {
    await new LabeledInputPo(this.page, '[data-testid="ace-fqdn-input"] input', this.self()).set(val);
  }

  async enterCaCerts(val: string): Promise<void> {
    await new LabeledInputPo(
      this.page,
      '[data-testid="ace-cacerts-input"] textarea, [data-testid="ace-cacerts-input"] input',
      this.self(),
    ).set(val);
  }
}
