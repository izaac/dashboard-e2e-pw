import type { Page, Locator } from '@playwright/test';
import RootClusterPage from '@/e2e/po/pages/root-cluster-page.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';

export class HomeLinksPagePo extends RootClusterPage {
  static url = '/c/_/settings/links';

  constructor(page: Page) {
    super(page, HomeLinksPagePo.url);
  }

  addLinkButton(): Locator {
    return this.page.getByTestId('add_row_item_button');
  }

  displayTextInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, '.kv-item.key input', this.self());
  }

  urlInput(): LabeledInputPo {
    return new LabeledInputPo(this.page, '[data-testid="value-multiline"]');
  }

  saveButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="action-button-async-button"]');
  }

  defaultLinkCheckboxes(): Locator {
    return this.page.locator('div.link-show-hide-checkbox');
  }

  supportLinks(): Locator {
    return this.page.locator('.support-link a');
  }

  removeItemButton(): Locator {
    return this.page.getByTestId('remove-column-0');
  }

  selectCheckbox(index: number): CheckboxInputPo {
    return new CheckboxInputPo(this.page, `[data-testid="custom-links__checkbox-${index}"]`);
  }

  removeLinkButton(): Locator {
    return this.page.getByTestId('remove-column-0');
  }

  applyButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="action-button-async-button"]', this.self());
  }

  async applyAndWait(endpoint: string): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes(endpoint) && resp.request().method() === 'PUT',
    );

    await this.applyButton().click();
    await responsePromise;
  }

  defaultLinkNames(): Locator {
    return this.self().locator('.ui-links-setting .kv-item.key > span');
  }

  async checkDefaultLinkName(index: number, text: string): Promise<void> {
    const { expect } = await import('@playwright/test');
    const el = this.defaultLinkNames().nth(index);

    await expect(el).toHaveText(text);
  }

  defaultLinkTargets(): Locator {
    return this.self().locator('.ui-links-setting .kv-item.value > span');
  }

  async checkDefaultLinkTargets(index: number, text: string): Promise<void> {
    const { expect } = await import('@playwright/test');
    const el = this.defaultLinkTargets().nth(index);

    await expect(el).toHaveText(text);
  }

  defaultLinkCheckbox(index: number): CheckboxInputPo {
    return new CheckboxInputPo(this.page, ':scope', this.self().locator('div.link-show-hide-checkbox').nth(index));
  }

  waitForRequests(): void {
    // Placeholder - upstream uses goToAndWaitForGet which is Cypress-specific
  }

  /** KeyValue component debounces update events by 500ms — call after last field interaction */
  async waitForKeyValueDebounce(): Promise<void> {
    await this.page.waitForTimeout(600);
  }
}
