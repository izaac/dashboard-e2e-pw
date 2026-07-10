import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';

export default class WorkloadDashboardPagePo extends PagePo {
  constructor(page: Page, clusterId = 'local') {
    super(page, `/c/${clusterId}/explorer/workload-dashboard`);
  }

  static async navTo(page: Page, clusterId = 'local'): Promise<void> {
    const burgerMenu = new BurgerMenuPo(page);
    const sideNav = new ProductNavPo(page);

    await burgerMenu.goToCluster(clusterId);
    await sideNav.navToSideMenuGroupByLabel('Workloads');
  }

  masthead(): Locator {
    return this.self().locator('.with-subheader, .title-bar');
  }

  title(): Locator {
    return this.masthead().locator('h1');
  }

  subtitle(): Locator {
    return this.masthead().locator('.sub-header');
  }

  byStateSection(): Locator {
    return this.page.getByTestId('workload-dashboard-by-state');
  }

  stateCards(): Locator {
    return this.page.getByTestId('workload-dashboard-state-card');
  }

  byTypeSection(): Locator {
    return this.page.getByTestId('workload-dashboard-by-type');
  }

  byTypeCards(): Locator {
    return this.page.getByTestId('resource-detail-status-card');
  }

  emptyState(): Locator {
    return this.page.getByTestId('workload-dashboard-empty');
  }

  errorBanner(): Locator {
    return this.page.locator('.banner.error');
  }
}
