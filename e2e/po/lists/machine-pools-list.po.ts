import type { Page, Locator } from '@playwright/test';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';

export default class MachinePoolsListPo extends BaseResourceList {
  constructor(page: Page, selector: string, parent?: Locator) {
    super(page, selector, parent);
  }

  details(name: string, index: number): Locator {
    return this.resourceTable().sortableTable().rowWithPartialName(name).column(index);
  }

  machinePoolReadyofDesiredCount(poolName: string, count: RegExp, _options?: { timeout?: number }): Locator {
    return this.resourceTable()
      .sortableTable()
      .groupElementWithName(poolName)
      .locator('.group-header-buttons')
      .locator(`text=${count}`);
  }

  machineProgressBar(poolName: string): Locator {
    return this.resourceTable()
      .sortableTable()
      .groupElementWithName(poolName)
      .locator('[data-testid="machine-progress-bar"]');
  }

  scaleDownButton(poolName: string): Locator {
    return this.resourceTable()
      .sortableTable()
      .groupElementWithName(poolName)
      .locator('[data-testid="scale-down-button"]');
  }

  scaleUpButton(poolName: string): Locator {
    return this.resourceTable()
      .sortableTable()
      .groupElementWithName(poolName)
      .locator('[data-testid="scale-up-button"]');
  }

  machineUnavailableCount(poolName: string): Locator {
    return this.resourceTable()
      .sortableTable()
      .groupElementWithName(poolName)
      .locator('[data-testid="machine-progress-popper"] tr:has-text("Unavailable") td')
      .last();
  }

  scaleButtonTooltip(poolName: string, button: 'plus' | 'minus'): Locator {
    return this.resourceTable()
      .sortableTable()
      .groupElementWithName(poolName)
      .locator(`.group-header-buttons button .icon-${button}`);
  }

  scalePoolDownConfirm(): Locator {
    return this.page.getByTestId('scale-pool-down-confirm');
  }
}
