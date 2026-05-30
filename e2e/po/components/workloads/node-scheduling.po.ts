import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import RadioGroupInputPo from '@/e2e/po/components/radio-group-input.po';

const SELECT_NODE = '[data-testid="node-scheduling-selectNode"]';
const NODE_SELECTOR = '[data-testid="node-scheduling-nodeSelector"]';

export default class NodeSchedulingPo extends ComponentPo {
  constructor(page: Page, selector = SELECT_NODE) {
    super(page, selector);
  }

  selectNodeRadio(): RadioGroupInputPo {
    return new RadioGroupInputPo(this.page, SELECT_NODE);
  }

  async selectAnyNode(): Promise<void> {
    await this.selectNodeRadio().set(0);
  }

  async selectSpecificNode(): Promise<void> {
    await this.selectNodeRadio().set(1);
  }

  async selectSchedulingRules(): Promise<void> {
    await this.selectNodeRadio().set(2);
  }

  /** aria-checked span for a radio option, for the spec to assert against */
  radioOption(index: number): Locator {
    return this.selectNodeRadio().radioSpan(index);
  }

  nodeSelector(): Locator {
    return this.page.locator(NODE_SELECTOR);
  }
}
