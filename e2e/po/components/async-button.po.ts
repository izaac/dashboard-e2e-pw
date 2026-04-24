import type { Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class AsyncButtonPo extends ComponentPo {
  async click(force = false): Promise<void> {
    await this.self().click({ force });
  }

  label(name: string): Locator {
    return this.self().getByText(name);
  }

  async action(label: string, labelDone: string): Promise<void> {
    await this.self().filter({ hasText: label }).waitFor({ state: 'visible' });
    await this.self().click();
    await this.self().filter({ hasText: labelDone }).waitFor({ state: 'visible' });
  }

  async apply(): Promise<void> {
    await this.action('Apply', 'Applied');
  }
}
