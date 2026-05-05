import type { Page } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import ResourceTablePo from '@/e2e/po/components/resource-table.po';
import KubectlPo from '@/e2e/po/components/kubectl.po';
import { VERY_LONG } from '@/support/timeouts';

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

  /** Close the kubectl terminal and wait for each installable part to reach `Deployed`. */
  async closeTerminalAndWaitDeployed(installableParts: string[]): Promise<void> {
    await this.terminal.closeTerminal();

    for (const item of installableParts) {
      // VERY_LONG (60s) instead of 30s — multi-chart installs (CRD + main app)
      // can take ~45s for all rows to reflect Deployed state in the SPA after
      // helm finishes (steve aggregator + Vue list re-render lag).
      await this.appsList()
        .resourceTableDetails(item, 1)
        .filter({ hasText: 'Deployed' })
        .waitFor({ timeout: VERY_LONG });
    }
  }
}
