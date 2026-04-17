import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

export default class KubectlPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '#horizontal-window-manager');
  }

  async openTerminal(timeout = 30000): Promise<void> {
    await this.page.locator('#btn-kubectl').click({ timeout });
    await expect(this.self().locator('.window.show-grid .text-success')).toContainText('Connected', { timeout });
  }

  async closeTerminal(): Promise<void> {
    await this.self().getByTestId('wm-tab-close-button').click();
  }

  async closeTerminalByTabName(name: string): Promise<void> {
    await this.self().locator(`[aria-label="${name}"] [data-testid="wm-tab-close-button"]`).click();
  }

  async waitForTerminalStatus(status: string, timeout = 60000): Promise<void> {
    await expect(this.self().locator('.status')).toContainText(status, { timeout });
  }

  async waitForTerminalToBeVisible(): Promise<void> {
    await expect(this.self().getByTestId('wm-tab-close-button')).toBeVisible();
  }

  async executeCommand(command: string, wait = 3000): Promise<KubectlPo> {
    const terminal = this.self().locator('.window.show-grid .xterm-helper-textarea');

    await terminal.focus();
    await terminal.fill(`kubectl ${command}`);
    await terminal.press('Enter');
    await this.page.waitForTimeout(wait);

    return this;
  }

  async openAndExecuteCommand(command: string, wait = 3000): Promise<KubectlPo> {
    await this.openTerminal();
    await this.executeCommand(command, wait);

    return this;
  }
}
