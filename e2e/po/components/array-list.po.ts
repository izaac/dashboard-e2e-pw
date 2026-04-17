import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class ArrayListPo extends ComponentPo {
  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  arrayListItem(index: number, parentIndex?: number): Locator {
    if (parentIndex !== undefined) {
      return this.self()
        .locator(`[data-testid="array-list-box${parentIndex}"]`)
        .locator(`[data-testid="array-list-box${index}"]`);
    }

    return this.self().locator(`[data-testid="array-list-box${index}"]`);
  }

  async closeArrayListItem(index: number, parentIndex?: number, buttonIndex?: number): Promise<void> {
    await this.arrayListItem(index, parentIndex)
      .locator(`[data-testid="remove-item-${buttonIndex || 0}"]`)
      .click();
  }

  async clickAdd(label: string, parentIndex?: number): Promise<void> {
    if (parentIndex !== undefined) {
      await this.arrayListItem(parentIndex)
        .locator('[data-testid="array-list-button"]')
        .filter({ hasText: label })
        .click();

      return;
    }

    await this.self().locator('[data-testid="array-list-button"]').filter({ hasText: label }).click();
  }

  async clearListItem(index: number): Promise<void> {
    await this.self().locator(`[data-testid="array-list-box${index}"]`).locator('input').clear();
  }

  async setValueAtIndex(
    value: string,
    index: number,
    label: string,
    parentIndex?: number,
    clickAdd = true,
  ): Promise<void> {
    if (clickAdd) {
      await this.clickAdd(label, parentIndex);
    }

    await this.arrayListItem(index, parentIndex).locator('input').fill(value);
  }
}
