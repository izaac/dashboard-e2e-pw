import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

/**
 * PO for the Redeploy Workload confirmation dialog.
 * Matches upstream: cypress/e2e/po/components/workloads/redeploy-dialog.po.ts
 */
export default class RedeployDialogPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '#modal-container-element');
  }

  applyButton(): Locator {
    return this.self().getByTestId('action-button-async-button');
  }

  cancelButton(): Locator {
    return this.self()
      .locator('button')
      .filter({ hasText: /cancel/i });
  }

  errorBanner(): Locator {
    return this.self().locator('.banner.error');
  }

  async confirmRedeploy(): Promise<void> {
    await this.applyButton().click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton().click();
  }
}
