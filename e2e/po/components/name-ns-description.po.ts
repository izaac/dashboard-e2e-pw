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

  /** Select "Create a New Namespace" and fill in the name */
  async createNewNamespace(name: string): Promise<void> {
    const nsSelect = this.self().getByTestId('name-ns-description-namespace');

    await nsSelect.click();

    const createOption = this.page
      .locator('.vs__dropdown-menu .vs__dropdown-option')
      .filter({ hasText: 'Create a New Namespace' });

    await createOption.click();
    await this.page.getByRole('textbox', { name: 'Name' }).first().fill(name);
  }

  project(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="name-ns-description-project"] input', this.self());
  }
}
