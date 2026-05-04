import type { Page } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import { DEBOUNCE, LONG, VERY_LONG } from '@/support/timeouts';

/** Default wait after `executeCommand` so kubectl output settles before the
 *  next interaction. xterm output is canvas-rendered so we cannot deterministically
 *  poll for a fresh prompt; callers can pass a longer wait for slow commands. */
const KUBECTL_OUTPUT_SETTLE = DEBOUNCE;

export default class KubectlPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '#horizontal-window-manager');
  }

  async openTerminal(timeout: number = LONG): Promise<void> {
    await this.page.locator('#btn-kubectl').click({ timeout });
    await this.self()
      .locator('.window.show-grid .text-success')
      .filter({ hasText: 'Connected' })
      .waitFor({ state: 'visible', timeout });
  }

  async closeTerminal(): Promise<void> {
    await this.self().getByTestId('wm-tab-close-button').click();
  }

  async closeTerminalByTabName(name: string): Promise<void> {
    await this.self().locator(`[aria-label="${name}"] [data-testid="wm-tab-close-button"]`).click();
  }

  async waitForTerminalStatus(status: string, timeout: number = VERY_LONG, tabName?: string): Promise<void> {
    if (tabName) {
      const tab = this.self().locator(`[id*="${tabName}"]`);

      await tab.locator('.status').filter({ hasText: status }).waitFor({ state: 'visible', timeout });
    } else {
      // Multiple tabs may exist; find any .status with matching text (may be hidden behind inactive tab)
      await this.self().locator('.status').filter({ hasText: status }).first().waitFor({ state: 'attached', timeout });
    }
  }

  async waitForTerminalToBeVisible(): Promise<void> {
    await this.self().getByTestId('wm-tab-close-button').waitFor({ state: 'visible' });
  }

  /**
   * Type a kubectl command into the embedded terminal and press Enter, then
   * sleep for `wait` ms so the canvas-rendered xterm output has time to flush
   * before the caller proceeds. xterm draws to a canvas (not DOM text), so a
   * web-first `expect(...)` poll for the new prompt is not feasible — the
   * sleep is the agreed escape hatch.
   */
  async executeCommand(command: string, wait: number = KUBECTL_OUTPUT_SETTLE): Promise<KubectlPo> {
    const terminal = this.self().locator('.window.show-grid .xterm-helper-textarea');

    await terminal.focus();
    await terminal.fill(`kubectl ${command}`);
    await terminal.press('Enter');
    // eslint-disable-next-line playwright/no-wait-for-timeout -- xterm canvas output cannot be polled via locators; this is the documented escape hatch
    await this.page.waitForTimeout(wait);

    return this;
  }

  async openAndExecuteCommand(command: string, wait: number = KUBECTL_OUTPUT_SETTLE): Promise<KubectlPo> {
    await this.openTerminal();
    await this.executeCommand(command, wait);

    return this;
  }
}
