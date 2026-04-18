import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';

export default class FleetApplicationDetailsPo extends PagePo {
  private static createPath(fleetWorkspace: string, appName: string, type: string) {
    return `/c/_/fleet/application/${type}/${fleetWorkspace}/${appName}`;
  }

  constructor(page: Page, fleetWorkspace: string, appName: string, type: string) {
    super(page, FleetApplicationDetailsPo.createPath(fleetWorkspace, appName, type));
  }

  bundlesCount(): Locator {
    return this.self().locator('[data-testid="resource-bundle-summary"] .count');
  }

  showConfig(): Locator {
    return this.self().locator('[data-testid="button-group-child-1"]');
  }

  showGraph(): Locator {
    return this.self().locator('[data-testid="button-group-child-2"]');
  }

  graph(): Locator {
    return this.self().locator('[data-testid="resource-graph"]');
  }
}
