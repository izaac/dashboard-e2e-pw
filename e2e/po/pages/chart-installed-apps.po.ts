import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
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

  /**
   * Wait for chart install POST response, close terminal, verify apps are Deployed.
   */
  async waitForInstallCloseTerminal(
    installResponse: Promise<import('@playwright/test').Response>,
    installableParts: string[],
  ): Promise<void> {
    const response = await installResponse;

    expect([200, 201]).toContain(response.status());

    // Buffer for install to be properly triggered
    await this.page.waitForTimeout(15000);
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

    // Additional wait for everything to be set up
    await this.page.waitForTimeout(10000);
  }
}
