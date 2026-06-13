import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import { waitForAnimationSettle } from '@/support/utils/debounce';

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
    // eslint-disable-next-line playwright/no-force-option -- hamburger icon can be briefly covered by SPA route-transition overlay
    await this.page.getByTestId('top-level-menu').click({ force: true });
    await waitForAnimationSettle(this.sideMenu(), 'burger-side-menu toggle');
  }

  /** Whether the slide-out menu is currently open */
  async isOpen(): Promise<boolean> {
    const cls = await this.sideMenu().getAttribute('class');

    return cls?.includes('menu-open') ?? false;
  }

  /** Open the slide-out menu only if it is currently closed (navigation auto-closes it) */
  async open(): Promise<void> {
    if (!(await this.isOpen())) {
      await this.toggle();
    }
  }

  /** Navigate to a top-level side menu entry by label (non-cluster) */
  async burgerMenuNavToMenuByLabel(label: string): Promise<void> {
    await this.sideMenu().waitFor({ state: 'attached' });
    // eslint-disable-next-line playwright/no-force-option -- side-menu link can be partially obscured by sticky scroll header in tall menus
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

  /**
   * Global application section links only (Cluster Management, Continuous
   * Delivery, etc.). Anchor `.option`s without `.cluster` — excludes the Home
   * anchor (`.option.cluster.home`) and the cluster buttons
   * (`button.cluster.selector.option`).
   */
  globalApps(): Locator {
    return this.self().locator('.body a.option:not(.cluster)');
  }

  /**
   * Resolve a single global-apps link by its accessible name. Used by the menu-walk
   * spec to avoid `nth(i)`: positional locators are lazy and re-resolve on every
   * call, so DOM reorders (extension-injected items) between `getAttribute('href')`
   * and `click()` can land on a different anchor. The href also shifts with route
   * context (`/c/local/...` at home vs `/c/_/...` once you enter a global page),
   * so aria-label is the only identifier stable enough to drive the walk.
   */
  globalAppByAriaLabel(label: string): Locator {
    return this.self().locator(`.body a.option:not(.cluster)[aria-label="${label}"]`).first();
  }

  /** Snapshot every global-apps link's aria-label (skips entries with no label). */
  async globalAppAriaLabels(): Promise<string[]> {
    const raw = await this.globalApps().evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));

    return raw.filter((l): l is string => !!l);
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
    // eslint-disable-next-line playwright/no-force-option -- cluster name in side-menu can be covered by sticky group header in tall cluster lists
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
