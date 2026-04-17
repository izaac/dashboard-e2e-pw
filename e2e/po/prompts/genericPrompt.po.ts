import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import CardPo from '@/e2e/po/components/card.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';

export default class GenericPrompt extends ComponentPo {
  private card: CardPo;

  constructor(page: Page, selector = '.modal-container') {
    super(page, selector);
    this.card = new CardPo(page);
  }

  getTitle(): Locator {
    return this.card.getTitle();
  }

  getBody(): Locator {
    return this.card.getBody();
  }

  labeledSelect(selector = '.labeled-select'): LabeledSelectPo {
    return new LabeledSelectPo(this.page, selector);
  }

  checkbox(selector = '[data-checkbox-ctrl]'): CheckboxInputPo {
    return new CheckboxInputPo(this.page, selector, this.self());
  }

  async clickActionButton(text: string): Promise<void> {
    await this.card.getActionButton().getByText(text).click();
  }
}
