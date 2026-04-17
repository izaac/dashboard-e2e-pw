import { expect } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class ButtonGroupPo extends ComponentPo {
  /** Click a button by its label text */
  async set(label: string): Promise<void> {
    await this.self().getByText(label).click();
  }

  /** Assert that a button with the given label is highlighted (selected) */
  async isSelected(label: string): Promise<void> {
    const btn = this.self().locator('.btn').filter({ hasText: label });

    await expect(btn).toHaveClass(/bg-primary/);
  }
}
