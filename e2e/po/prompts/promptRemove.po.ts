import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';

export default class PromptRemove extends ComponentPo {
  constructor(page: Page) {
    super(page, '[data-testid="card"].prompt-remove');
  }

  confirmField(): LabeledInputPo {
    return new LabeledInputPo(this.page, '#confirm');
  }

  async confirm(text: string): Promise<void> {
    await this.confirmField().set(text);
  }

  async remove(): Promise<void> {
    await this.self().getByTestId('prompt-remove-confirm-button').click();
  }

  async deactivate(): Promise<void> {
    await this.self().getByTestId('prompt-remove-confirm-button').click();
  }

  async cancel(): Promise<void> {
    await this.self().locator('.btn.role-secondary').filter({ hasText: 'Cancel' }).click();
  }

  warning(): Locator {
    return this.self().locator('.card-body .text-warning');
  }

  checkbox(): CheckboxInputPo {
    return new CheckboxInputPo(this.page, '[data-checkbox-ctrl]', this.self());
  }
}
