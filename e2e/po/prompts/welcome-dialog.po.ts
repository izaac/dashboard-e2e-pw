import type { Page } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

/**
 * Rancher Prime Welcome / What's New dialog that can appear on first load.
 */
export default class WelcomeDialogPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '.rc-modal-overlay');
  }

  /** Dismiss the dialog if it is currently mounted or mounting */
  async dismissIfVisible(timeout = 3000): Promise<void> {
    if (timeout > 0) {
      await this.self()
        .waitFor({ state: 'visible', timeout })
        .catch(() => {});
    }

    if (
      !(await this.self()
        .isVisible()
        .catch(() => false))
    ) {
      return;
    }

    const closeBtn = this.page
      .locator('#modals')
      .getByTestId('release-welcome-close')
      .or(this.page.locator('#modals').getByRole('button', { name: /Close/i }));

    if ((await closeBtn.count()) > 0) {
      await closeBtn.first().click();
    } else {
      await this.page.keyboard.press('Escape');
    }

    await this.self().waitFor({ state: 'detached', timeout: 5000 });
  }
}
