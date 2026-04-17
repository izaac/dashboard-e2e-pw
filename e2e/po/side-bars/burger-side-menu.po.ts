import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
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
    // Allow CSS transition to settle
    await this.page.waitForTimeout(500);
  }

  /** Navigate to a top-level side menu entry by label (non-cluster) */
  async burgerMenuNavToMenuByLabel(label: string): Promise<void> {
    await expect(this.sideMenu()).toBeAttached();
    await this.sideMenu().locator('.option').getByText(label).click({ force: true });
  }

  /** Navigate to a cluster on a top-level side menu entry by label */
  async burgerMenuNavToClusterByLabel(label: string): Promise<void> {
    await expect(this.sideMenu()).toBeAttached();
    await this.sideMenu().locator('.option .cluster-name').getByText(label).click();
  }

  /** Check key combo icon for a cluster by its displayed label */
  async burgerMenuNavClusterKeyComboIconCheckByLabel(label: string): Promise<void> {
    const clusterName = this.burgerMenuGetNavClusterByLabel(label);
    const selectorEl = clusterName.locator('xpath=ancestor::*[contains(@class,"cluster") and contains(@class,"selector")]').first();
    const icon = selectorEl.locator('.cluster-icon-menu i');

    await expect(icon).toHaveClass(/icon-keyboard_tab/);
  }

  /** Get menu navigation item by label */
  burgerMenuGetNavMenuByLabel(label: string): Locator {
    return this.sideMenu().locator('.option').getByText(label);
  }

  /** Get cluster navigation item by label */
  burgerMenuGetNavClusterByLabel(label: string): Locator {
    return this.sideMenu().locator('.option .cluster-name').getByText(label);
  }

  /** Check if Cluster Top Level Menu link is highlighted */
  async checkIfClusterMenuLinkIsHighlighted(name: string, isHighlighted = true): Promise<void> {
    const clusterEl = this.burgerMenuGetNavClusterByLabel(name)
      .locator('xpath=ancestor::*[contains(@class,"option")]').first();

    if (isHighlighted) {
      await expect(clusterEl).toHaveClass(/active-menu-link/);
    } else {
      await expect(clusterEl).not.toHaveClass(/active-menu-link/);
    }
  }

  /** Check if non-cluster Top Level Menu link is highlighted */
  async checkIfMenuItemLinkIsHighlighted(name: string): Promise<void> {
    const menuItem = this.burgerMenuGetNavMenuByLabel(name).locator('..');

    await expect(menuItem).toHaveClass(/active-menu-link/);
  }

  /** Check if menu is open */
  async checkOpen(): Promise<void> {
    await expect(this.sideMenu()).toHaveClass(/menu-open/);
  }

  /** Check if menu is closed */
  async checkClosed(): Promise<void> {
    await expect(this.sideMenu()).toHaveClass(/menu-close/);
  }

  /** Check icon tooltip is visible with expected content */
  async checkIconTooltipOn(content: string): Promise<void> {
    const tooltip = this.page.locator('.v-popper__popper .v-popper__inner');

    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(content);
  }

  /** Check icon tooltip is not visible */
  async checkIconTooltipOff(): Promise<void> {
    await expect(this.page.locator('.v-popper__popper')).not.toBeAttached();
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

    await expect(clusterName).toBeAttached();
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
