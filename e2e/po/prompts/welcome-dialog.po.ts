import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

/**
 * Release Welcome / What's New dialog that can appear on first load.
 */
export default class WelcomeDialogPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '.rc-modal-overlay');
  }

  dialogRoot(): Locator {
    return this.page.getByTestId('release-welcome');
  }

  title(): Locator {
    return this.page.getByTestId('release-welcome-title');
  }

  subtitle(): Locator {
    return this.page.getByTestId('release-welcome-subtitle');
  }

  cardsContainer(): Locator {
    return this.dialogRoot().locator('.release-welcome__cards');
  }

  whatsNewCard(): Locator {
    return this.page.getByTestId('release-welcome-whats-new');
  }

  whatsNewVersion(): Locator {
    return this.page.getByTestId('release-welcome-version');
  }

  releaseNotesLink(): Locator {
    return this.page.getByTestId('release-welcome-release-notes');
  }

  featureItems(): Locator {
    return this.whatsNewCard().locator('[data-testid^="release-welcome-feature-"]');
  }

  primePromoCard(): Locator {
    return this.page.getByTestId('release-welcome-prime');
  }

  primeExploreLink(): Locator {
    return this.page.getByTestId('release-welcome-prime-explore');
  }

  registrationCard(): Locator {
    return this.page.getByTestId('release-welcome-registration');
  }

  registrationPageLink(): Locator {
    return this.page.getByTestId('release-welcome-registration-page');
  }

  registrationOpenButton(): Locator {
    return this.page.getByTestId('release-welcome-registration-open');
  }

  closeButton(): Locator {
    return this.page.getByTestId('release-welcome-close');
  }

  /** Wait until the dialog is rendered and its cards have finished any resize/animation pass */
  async waitForSettled(): Promise<void> {
    await expect(this.dialogRoot()).toBeVisible();
    await expect(this.cardsContainer()).toBeVisible();
    await expect(this.cardsContainer()).not.toHaveClass(/--resizing/);
    await expect(this.whatsNewCard()).toBeVisible();
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
