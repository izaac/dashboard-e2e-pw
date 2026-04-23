import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import { STANDARD } from '@/support/timeouts';

export default class CruResourcePo extends ComponentPo {
  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  saveOrCreate(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="form-save"]', this.self());
  }

  cancel(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="form-cancel"]', this.self());
  }

  findSubTypeByName(name: string): Locator {
    return this.self().getByTestId(`subtype-banner-item-${name}`);
  }

  selectSubType(groupIndex: number, itemIndex: number): Locator {
    return this.self().locator('.subtypes-container > div').nth(groupIndex).locator('.item').nth(itemIndex);
  }

  selectSubTypeByIndex(index: number): Locator {
    return this.self().locator('.subtypes-container > div').nth(index);
  }

  async saveAndWaitForRequests(method: string, endpoint: string): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes(endpoint) && resp.request().method() === method,
      { timeout: STANDARD },
    );

    await this.saveOrCreate().click();
    await responsePromise;
  }
}
