import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import RadioGroupInputPo from '@/e2e/po/components/radio-group-input.po';

export default class CreateKeyPagePo extends PagePo {
  static url = '/account/create-key';

  constructor(page: Page) {
    super(page, CreateKeyPagePo.url);
  }

  title(): Locator {
    return this.page.locator('h1');
  }

  description(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Description');
  }

  expiryOptions(): RadioGroupInputPo {
    return new RadioGroupInputPo(this.page, '[data-testid="expiry__options"]');
  }

  createButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="action-button-async-button"]', this.self());
  }

  cancelButton(): Locator {
    return this.self().locator('button.role-secondary');
  }

  doneButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="token_done_create_button"]', this.self());
  }

  apiAccessKey(): Locator {
    return this.page.getByTestId('detail-top_html').first();
  }

  async done(): Promise<void> {
    await this.doneButton().click();
  }

  async create(): Promise<void> {
    await this.createButton().click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton().click();
  }
}
