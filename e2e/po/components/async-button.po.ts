import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class AsyncButtonPo extends ComponentPo {
  async click(force = false): Promise<void> {
    await this.self().click({ force });
  }

  async expectToBeDisabled(): Promise<void> {
    await expect(this.self()).toHaveAttribute('disabled', 'disabled');
  }

  async expectToBeEnabled(): Promise<void> {
    await expect(this.self()).not.toHaveAttribute('disabled');
  }

  async waitForDisabledAppearanceToDisappear(): Promise<void> {
    await expect(this.self()).toHaveClass(/ready-for-action/);
  }

  label(name: string): Locator {
    return this.self().getByText(name);
  }

  async action(label: string, labelDone: string): Promise<void> {
    await expect(this.self()).toContainText(label);
    await this.self().click();
    await expect(this.self()).toContainText(labelDone);
  }

  async apply(): Promise<void> {
    await this.action('Apply', 'Applied');
  }

  /** Return the computed `background` CSS property of the button */
  async computedBackground(): Promise<string> {
    return this.self().evaluate((el) => getComputedStyle(el).background);
  }
}
