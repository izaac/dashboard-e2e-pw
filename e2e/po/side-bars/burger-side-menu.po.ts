import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';

/**
 * Page object for the burger/side menu.
 * Replaces the Cypress BurgerMenuPo.
 *
 * Static methods from the Cypress version are converted to instance methods
 * since Playwright requires a Page reference.
 */
export default class BurgerMenuPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '[data-testid="side-menu"]');
  }

  /** Toggle side navigation via the hamburger icon */
  async toggle(): Promise<void> {
    await this.page.getByTestId('top-level-menu').click({ force: true });
    // Wait for the fade transition to actually finish instead of guessing 500 ms.
    // The Animations API resolves once any in-flight CSS transition on .side-menu (or descendants) completes.
    // Wrapped in catch so a navigation/element-detachment mid-evaluate (Vue <transition> replaces the node)
    // does not blow up the toggle — Playwright's auto-wait on the next action handles residual settle.
    await this.sideMenu()
      .evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {}))))
      .catch(() => {});
  }

  /** Navigate to a top-level side menu entry by label (non-cluster) */
  async burgerMenuNavToMenuByLabel(label: string): Promise<void> {
    await this.sideMenu().waitFor({ state: 'attached' });
    await this.sideMenu().locator('.option').getByText(label).click({ force: true });
  }

  /** Navigate to a cluster on a top-level side menu entry by label */
  async burgerMenuNavToClusterByLabel(label: string): Promise<void> {
    await this.sideMenu().waitFor({ state: 'attached' });
    await this.sideMenu().locator('.option .cluster-name').getByText(label).click();
  }

  /** Get the key combo icon locator for a cluster by label */
  clusterKeyComboIcon(label: string): Locator {
    const clusterName = this.burgerMenuGetNavClusterByLabel(label);

    return clusterName
      .locator('xpath=ancestor::*[contains(@class,"cluster") and contains(@class,"selector")]')
      .first()
      .locator('.cluster-icon-menu i');
  }

  /** Get menu navigation item by label */
  burgerMenuGetNavMenuByLabel(label: string): Locator {
    return this.sideMenu().locator('.option').getByText(label);
  }

  /** Get cluster navigation item by label */
  burgerMenuGetNavClusterByLabel(label: string): Locator {
    return this.sideMenu().locator('.option .cluster-name').getByText(label);
  }

  /** Get the cluster option wrapper for highlight state checks */
  clusterOptionWrapper(name: string): Locator {
    return this.burgerMenuGetNavClusterByLabel(name).locator('xpath=ancestor::*[contains(@class,"option")]').first();
  }

  /** Get the menu item wrapper for highlight state checks */
  menuItemWrapper(name: string): Locator {
    return this.burgerMenuGetNavMenuByLabel(name).locator('..');
  }

  /** Get the tooltip inner element */
  tooltip(): Locator {
    return this.page.locator('.v-popper__popper .v-popper__inner');
  }

  /** Get the tooltip container (for detached checks) */
  tooltipContainer(): Locator {
    return this.page.locator('.v-popper__popper');
  }

  /** Get the side navigation root element */
  sideMenu(): Locator {
    return this.page.getByTestId('side-menu');
  }

  /** Get menu category labels */
  categories(): Locator {
    return this.self().locator('.body .category');
  }

  /** Get menu category by label text */
  categoryByLabel(label: string): Locator {
    return this.sideMenu().locator('.body .category').getByText(label);
  }

  /** Get the first option link in the section that contains the given category label */
  firstOptionLinkInCategorySection(label: string): Locator {
    return this.categoryByLabel(label)
      .locator('xpath=ancestor::*[contains(@class,"category")]/../..')
      .locator('.option-link')
      .first();
  }

  /** Focus the page body (useful before keyboard shortcuts) */
  async focusBody(): Promise<void> {
    await this.page.locator('body').focus();
  }

  /** Get all the links in the side navigation */
  links(): Locator {
    return this.self().locator('.body .option');
  }

  /** Get all clusters (pinned, filtered, or not) */
  allClusters(): Locator {
    return this.self().locator('.body .clusters .cluster.selector.option');
  }

  /** Get the first cluster icon */
  firstClusterIcon(): Locator {
    return this.allClusters().first().locator('.rancher-provider-icon');
  }

  /** Navigate to a cluster by clicking its name in the side menu */
  async goToCluster(clusterId = 'local', toggleOpen = true): Promise<void> {
    if (toggleOpen) {
      await this.toggle();
    }

    const clusterName = this.self().locator('.cluster-name').getByText(clusterId);

    await clusterName.waitFor({ state: 'attached' });
    await clusterName.click({ force: true });
  }

  /** Get unpinned cluster list */
  clusterNotPinnedList(): Locator {
    return this.self().locator('.body .clustersList .cluster.selector.option');
  }

  /** Pin the first cluster in the unpinned list */
  async pinFirstCluster(): Promise<void> {
    const firstCluster = this.clusterNotPinnedList().first();

    await firstCluster.hover();
    await firstCluster.locator('.pin').click();
  }

  /** Get the pinned cluster list */
  clusterPinnedList(): Locator {
    return this.self().locator('.body .clustersPinned .cluster.selector.option');
  }

  /** Unpin the first pinned cluster */
  async unpinFirstCluster(): Promise<void> {
    await this.clusterPinnedList().first().locator('.pin').click();
  }

  /** Get cluster icon element by cluster name */
  getClusterIcon(clusterName = 'local'): Locator {
    return this.self().locator('.cluster-name').getByText(clusterName).locator('..');
  }

  /** Get cluster description text */
  async getClusterDescription(clusterName = 'local'): Promise<string> {
    return await this.getClusterIcon(clusterName).locator('.description').innerText();
  }

  /** Hover over cluster description to trigger tooltip */
  async showClusterDescriptionTooltip(clusterName = 'local'): Promise<void> {
    await this.getClusterIcon(clusterName).locator('.description').hover();
  }

  /** Get the tooltip content element */
  getClusterDescriptionTooltipContent(): Locator {
    return this.page.locator('.v-popper__popper .v-popper__inner');
  }

  /** Get the Home link */
  home(): Locator {
    return this.self().locator('.body > div > div > a').first();
  }

  /** Get the About link */
  about(): Locator {
    return this.self().locator('[aria-label="About page link"]');
  }

  /** Get the Get Support link */
  support(): Locator {
    return this.self().locator('[aria-label="Support page link"]');
  }

  /** Get the side menu logo image */
  brandLogoImage(): Locator {
    return this.page.getByTestId('side-menu__brand-img');
  }

  /** Get the header logo image */
  headerBrandLogoImage(): Locator {
    return this.page.getByTestId('header__brand-img');
  }
}
