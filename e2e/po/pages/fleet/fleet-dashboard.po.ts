import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import FleetDashboardWorkspaceCardPo from '@/e2e/po/components/fleet/fleet-dashboard-workspace-card.po';
import ButtonGroupPo from '@/e2e/po/components/button-group.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';

export class FleetDashboardListPagePo extends PagePo {
  constructor(page: Page, clusterId = '_') {
    super(page, `/c/${clusterId}/fleet`);
  }

  async navTo(): Promise<void> {
    const burgerMenu = new BurgerMenuPo(this.page);

    await burgerMenu.toggle();
    await burgerMenu.burgerMenuNavToMenuByLabel('Continuous Delivery');
  }

  workspaceCard(name: string): FleetDashboardWorkspaceCardPo {
    return new FleetDashboardWorkspaceCardPo(this.page, name);
  }

  slideInPanel(): Locator {
    return this.page.getByTestId('slide-in-panel-component');
  }

  slideInPanelTitleLink(name: string): Locator {
    return this.slideInPanel().locator('.title a.label').filter({ hasText: name });
  }

  fleetDashboardEmptyState(): Locator {
    return this.self().locator('.fleet-empty-dashboard');
  }

  getStartedButton(): Locator {
    return this.self().locator('.btn').filter({ hasText: 'Get started' });
  }

  viewModeButton(): ButtonGroupPo {
    return new ButtonGroupPo(this.page, '[data-testid="view-button"]', this.self());
  }

  baseResourceList(): BaseResourceList {
    return new BaseResourceList(this.page, ':scope', this.self());
  }

  resourceTableDetails(name: string, index: number): Locator {
    return this.baseResourceList().resourceTable().resourceTableDetails(name, index);
  }

  async goToDetailsPage(name: string, selector?: string): Promise<void> {
    await this.baseResourceList().resourceTable().goToDetailsPage(name, selector);
  }
}
