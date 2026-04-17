import type { Page, Locator } from '@playwright/test';
import RootClusterPage from '@/e2e/po/pages/root-cluster-page.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import CardPo from '@/e2e/po/components/card.po';

export class PerformancePagePo extends RootClusterPage {
  static url = '/c/_/settings/performance';

  constructor(page: Page) {
    super(page, PerformancePagePo.url);
  }

  saveButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="performance__save-btn"]');
  }

  websocketCheckbox(): Locator {
    return this.page.getByRole('checkbox', { name: 'Disable websocket notifications' });
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
