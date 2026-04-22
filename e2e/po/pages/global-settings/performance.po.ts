import type { Page, Locator } from '@playwright/test';
import RootClusterPage from '@/e2e/po/pages/root-cluster-page.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import CardPo from '@/e2e/po/components/card.po';

export class PerformancePagePo extends RootClusterPage {
  static url = '/c/_/settings/performance';

  constructor(page: Page) {
    super(page, PerformancePagePo.url);
  }

  saveButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="performance__save-btn"]');
  }

  inactivityCheckbox(): CheckboxInputPo {
    return CheckboxInputPo.byLabel(this.page, this.self(), 'Enable inactivity session expiration ');
  }

  inactivityInput(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Inactivity timeout (minutes) ');
  }

  garbageCollectionResourceCount(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Resource Count');
  }

  namespaceFilteringCheckbox(): CheckboxInputPo {
    return CheckboxInputPo.byLabel(this.page, this.self(), 'Enable Required Namespace / Project Filtering');
  }

  websocketWebWorkerCheckbox(): CheckboxInputPo {
    return CheckboxInputPo.byLabel(this.page, this.self(), 'Enable Advanced Websocket Web Worker ');
  }

  serverSidePaginationCheckbox(): CheckboxInputPo {
    return CheckboxInputPo.byLabel(this.page, this.self(), 'Enable Server-side Pagination ');
  }

  applyButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="performance__save-btn"]', this.self());
  }

  async applyAndWait(context: string, endpoint = 'ui-performance'): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes(endpoint) && resp.request().method() === 'PUT',
    );

    await this.applyButton().click();
    await responsePromise;
  }

  async restoresInactivitySettings(): Promise<void> {
    await this.inactivityInput().clear();
    await this.inactivityInput().set('900');
    await this.inactivityCheckbox().set();
    await this.applyAndWait('reset-inactivity');
  }

  websocketCheckbox(): Locator {
    // Rancher checkbox renders hidden <input> + visible <span role="checkbox">; pick the visible one
    return this.page.getByRole('checkbox', { name: 'Disable websocket notifications' }).last();
  }

  incrementalLoadingCheckbox(): Locator {
    return this.page.getByRole('checkbox', { name: 'Enable incremental loading' });
  }

  manualRefreshCheckbox(): Locator {
    return this.page.getByRole('checkbox', { name: 'Enable manual refresh of data for lists' });
  }

  garbageCollectionCheckbox(): Locator {
    return this.page.getByRole('checkbox', { name: 'Enable Garbage Collection' });
  }

  garbageCollectionThresholdInput(): Locator {
    return this.page.getByRole('spinbutton', { name: 'Resource Count' });
  }

  nsFilterCheckbox(): Locator {
    return this.page.getByRole('checkbox', { name: 'Enable Required Namespace / Project Filtering' });
  }

  advancedWorkerCheckbox(): Locator {
    return this.page.getByRole('checkbox', { name: 'Enable Advanced Websocket Web Worker' });
  }

  confirmationModal(): CardPo {
    return new CardPo(this.page);
  }
}
