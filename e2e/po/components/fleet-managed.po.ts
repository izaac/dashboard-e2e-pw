import type { Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

/**
 * Fleet "Managed" badge and "managed by Continuous Delivery" banner shown on
 * resources that carry the fleet.cattle.io/managed-by-* labels.
 */
export default class FleetManagedPo extends ComponentPo {
  badge(): Locator {
    return this.self().getByTestId('fleet-managed-badge');
  }

  badgeIcon(): Locator {
    return this.badge().locator('.icon, i');
  }

  banner(): Locator {
    return this.self().getByTestId('fleet-managed-banner');
  }

  bannerLink(): Locator {
    return this.banner().getByTestId('fleet-managed-banner-link');
  }
}
