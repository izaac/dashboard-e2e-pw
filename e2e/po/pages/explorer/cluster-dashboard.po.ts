import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import ResourceTablePo from '@/e2e/po/components/resource-table.po';
import { HeaderPo } from '@/e2e/po/components/header.po';

/**
 * Page object for the Cluster Dashboard / Explorer landing page.
 */
export default class ClusterDashboardPagePo extends PagePo {
  private static createPath(clusterId: string) {
    return `/c/${clusterId}/explorer`;
  }

  constructor(page: Page, clusterId: string) {
    super(page, ClusterDashboardPagePo.createPath(clusterId));
  }

  urlPath(clusterId = 'local'): string {
    return ClusterDashboardPagePo.createPath(clusterId);
  }

  customBadge(): Locator {
    return this.page.locator('[data-testid="custom-badge-dialog"]');
  }

  customizeAppearanceButton(): Locator {
    return this.page.getByTestId('add-custom-cluster-badge');
  }

  certificates(): Locator {
    return this.page.locator('.certificates');
  }

  expiredBanner(): Locator {
    return this.page.locator('#cluster-certs .banner.error');
  }

  expiringBanner(): Locator {
    return this.page.locator('#cluster-certs .banner.warning');
  }

  async clickCertificatesTab(): Promise<void> {
    await this.tabs().self().scrollIntoViewIfNeeded();
    await this.tabs().clickNthTab(2);
  }

  async eventsRowCountMenuToggle(): Promise<void> {
    await this.page.getByTestId('events-list-row-count-menu-toggle').click();
  }

  eventsRowCountMenu(): Locator {
    return this.page.locator('[dropdown-menu-collection]:visible');
  }

  tabs(): TabbedPo {
    return new TabbedPo(this.page, '[data-testid="tabbed"]');
  }

  fullEventsLink(): Locator {
    return this.page.getByTestId('events-link').filter({ hasText: 'Full events list' });
  }

  fullSecretsList(): Locator {
    return this.page.locator('.cert-table-link').filter({ hasText: 'Full secrets list' });
  }

  eventsList(): ResourceTablePo {
    return new ResourceTablePo(this.page, '#cluster-events [data-testid="sortable-table-list-container"]');
  }

  certificatesList(): ResourceTablePo {
    return new ResourceTablePo(this.page, '#cluster-certs [data-testid="sortable-table-list-container"]');
  }

  clusterActionsHeader(): HeaderPo {
    return new HeaderPo(this.page);
  }

  fleetStatus(): Locator {
    return this.page.getByTestId('k8s-service-fleet');
  }

  etcdStatus(): Locator {
    return this.page.getByTestId('k8s-service-etcd');
  }

  schedulerStatus(): Locator {
    return this.page.getByTestId('k8s-service-scheduler');
  }

  controllerManagerStatus(): Locator {
    return this.page.getByTestId('k8s-service-controller-manager');
  }

  async goToAndConfirmNsValues(
    cluster: string,
    opts: {
      nsProject?: { values: string[] };
      all?: { is: boolean };
    },
  ): Promise<void> {
    await this.goTo();
    await this.waitForPage();

    const nsFilter = this.page.getByTestId('namespaces-filter');

    await expect(nsFilter).toBeVisible();

    if (opts.nsProject) {
      for (const val of opts.nsProject.values) {
        await expect(nsFilter).toContainText(val);
      }
    } else if (opts.all) {
      await expect(nsFilter).toContainText('All Namespaces');
    } else {
      throw new Error('Bad Config');
    }
  }

  certsSectionLocator(): Locator {
    return this.page.locator('[data-testid="cluster-certs"]');
  }

  fullSecretsListLink(): Locator {
    return this.page.locator('a').filter({ hasText: 'Full secrets list' });
  }

  deploymentsBox(): Locator {
    return this.page.locator('.count-box, .simple-box').filter({ hasText: 'Deployments' });
  }

  nodesBox(text: string): Locator {
    return this.page.locator('.count-box, .simple-box').filter({ hasText: new RegExp(`\\b${text}\\b`) });
  }

  async goToAndWait(): Promise<void> {
    await this.goTo();
    await this.clusterActionsHeader().self().waitFor({ state: 'visible' });
  }
}
