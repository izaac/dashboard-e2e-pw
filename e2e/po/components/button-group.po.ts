import type { Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class ButtonGroupPo extends ComponentPo {
  /** Click a button by its label text */
  async set(label: string): Promise<void> {
    await this.self().getByText(label).click();
  }

  /** Click a button by its zero-based position */
  async selectByIndex(index: number): Promise<void> {
    await this.self().locator(`[data-testid="button-group-child-${index}"]`).click();
  }

  /** Locator for a specific button by label */
  button(label: string): Locator {
    return this.self().locator('.btn').filter({ hasText: label });
  }
}
