import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';

export default class NameNsDescriptionPo extends ComponentPo {
  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  name(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="name-ns-description-name"] input', this.self());
  }

  description(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="name-ns-description-description"] input', this.self());
  }

  namespace(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="name-ns-description-namespace"]', this.self());
  }

  async selectNamespace(label: string): Promise<void> {
    await this.namespace().toggle();
    await this.namespace().clickLabel(label);
  }

  project(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="name-ns-description-project"] input', this.self());
  }
}
