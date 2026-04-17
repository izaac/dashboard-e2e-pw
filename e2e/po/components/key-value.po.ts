import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class KeyValuePo extends ComponentPo {
  addButton(label: string): Locator {
    return this.self().getByTestId('add_row_item_button').filter({ hasText: label });
  }

  async setKeyValueAtIndex(label: string, key: string, value: string, index: number, selector: string): Promise<void> {
    await this.addButton(label).click();
    await this.self().locator(`${selector} [data-testid="input-kv-item-key-${index}"]`).fill(key);
    await this.self().locator(`${selector} [data-testid="kv-item-value-${index}"]`).fill(value);
  }
}
