import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ResourceTablePo from '@/e2e/po/components/resource-table.po';
import KubectlPo from '@/e2e/po/components/kubectl.po';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import { LONG, PROVISIONING } from '@/support/timeouts';

export default class ChartInstalledAppsListPagePo extends PagePo {
  private terminal: KubectlPo;

  constructor(page: Page, clusterId = 'local', product: 'apps' | 'manager' = 'apps') {
    super(page, `/c/${clusterId}/${product}/catalog.cattle.io.app`);
    this.terminal = new KubectlPo(page);
  }

  async filter(key: string): Promise<void> {
    await this.self().locator('.input-sm.search-box').fill(key);
  }

  appsList(): ResourceTablePo {
    return new ResourceTablePo(this.page, '[data-testid="installed-app-catalog-list"]');
  }

  /**
   * Wait for each helm release to reach `deployed` via the Rancher API (the
   * source of truth — no Steve-aggregator/Vue-list lag), then close the
   * kubectl terminal and verify the UI row reflects the same state.
   *
   * The API wait uses `PROVISIONING` budget per release because cold ranchers
   * (fresh data volume + first-time chart clone) can need several minutes for
   * Helm to finalise. The UI sanity check after that uses `LONG` (30s) since
   * the resource is already `deployed` server-side; we are only verifying the
   * front-end caught up, not waiting on the install itself.
   */
  async closeTerminalAndWaitDeployed(api: RancherApi, namespace: string, installableParts: string[]): Promise<void> {
    for (const item of installableParts) {
      await api.expectResourceState(
        'v1',
        'catalog.cattle.io.apps',
        `${namespace}/${item}`,
        (resp) => resp.status === 200 && resp.body?.metadata?.state?.name === 'deployed',
        Math.floor(PROVISIONING / 5000),
        5000,
      );
    }

    await this.terminal.closeTerminal();

    for (const item of installableParts) {
      await expect(this.appsList().resourceTableDetails(item, 1).filter({ hasText: 'Deployed' })).toBeVisible({
        timeout: LONG,
      });
    }
  }
}
