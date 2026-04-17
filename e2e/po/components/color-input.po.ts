import type { Locator } from '@playwright/test';

/**
 * Page object for Rancher color picker component.
 * Wraps a Locator directly since color pickers are identified by index (nth)
 * which doesn't map to a single CSS selector.
 */
export default class ColorInputPo {
  private locator: Locator;

  constructor(locator: Locator) {
    this.locator = locator;
  }

  self(): Locator {
    return this.locator;
  }

  async value(): Promise<string> {
    const text = await this.locator.locator('.color-value').textContent();

    return (text || '').trim().toLowerCase();
  }

  async previewColor(): Promise<string> {
    return this.locator.locator('.color-display').evaluate((el) => getComputedStyle(el).backgroundColor);
  }

  async set(color: string): Promise<void> {
    await this.locator.locator('input').evaluate((el, c) => {
      (el as HTMLInputElement).value = c;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, color);
  }
}
