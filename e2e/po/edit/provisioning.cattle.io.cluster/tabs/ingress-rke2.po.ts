import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';

/**
 * Ingress controller section of the RKE2/K3s cluster Basics tab: the enable
 * checkbox, the Traefik / Ingress-NGINX / Dual cards and the info banners.
 */
export default class IngressRke2Po extends ComponentPo {
  constructor(page: Page, parent?: Locator) {
    super(page, '.dashboard-root', parent);
  }

  /** "Install Ingress controller to enable external routing" toggle */
  enableCheckbox(): CheckboxInputPo {
    return CheckboxInputPo.byLabel(this.page, this.self(), 'Install Ingress controller');
  }

  private card(id: string): Locator {
    return this.self().getByTestId(`item-card-${id}`);
  }

  nginxCard(): Locator {
    return this.card('ingress-nginx');
  }

  traefikCard(): Locator {
    return this.card('traefik');
  }

  dualCard(): Locator {
    return this.card('dual');
  }

  /** The card body text (description) for the given card locator */
  cardContent(card: Locator): Locator {
    return card.getByTestId('item-card-content');
  }

  /** Click the header of a card, as a user would (disabled cards simply ignore it) */
  async clickCard(card: Locator): Promise<void> {
    await card.getByTestId('card-header-left').click();
  }

  /** Info banner shown while Rancher transitions from Ingress-NGINX to Traefik */
  transitioningBanner(): Locator {
    return this.self().locator('.banner.info').filter({ hasText: 'transitioning to Traefik' });
  }

  /** Warning banner shown when the Ingress controller is not installed */
  disabledBanner(): Locator {
    return this.self().locator('.banner.warning').filter({ hasText: 'Without an Ingress controller' });
  }

  /** Error banner shown when an edited standalone Ingress-NGINX cluster targets Kubernetes 1.37 or later */
  nginxUpgradeBlockedBanner(): Locator {
    return this.self().locator('.banner.error').filter({ hasText: 'cannot use standalone Ingress-NGINX' });
  }

  /** Warning banner shown when an upgrade to Kubernetes 1.37 or later makes standalone Ingress-NGINX unrecoverable */
  nginxUpgradeWarningBanner(): Locator {
    return this.self().locator('.banner.warning').filter({ hasText: 'cannot switch back to standalone Ingress-NGINX' });
  }
}
