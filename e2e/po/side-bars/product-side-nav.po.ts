import type { Page, Locator } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import VersionNumberPo from '@/e2e/po/components/version-number.po';
import { LONG } from '@/support/timeouts';

/**
 * Page object for the product side navigation panel.
 * Replaces the Cypress ProductNavPo.
 */
export default class ProductNavPo extends ComponentPo {
  constructor(page: Page) {
    super(page, '.side-nav');
  }

  /** Get all navigation accordion groups */
  groups(): Locator {
    return this.self().locator('.accordion.has-children');
  }

  /** Get a nav group by its visible name */
  groupByName(name: string): Locator {
    return this.groups().filter({ hasText: name });
  }

  /** Get all non-expanded (closed) accordion groups */
  closedGroups(): Locator {
    return this.self().locator('.accordion.has-children:not(.expanded)');
  }

  /** Get all navigation accordion items */
  accordionItems(): Locator {
    return this.self().locator('.accordion');
  }

  /** Get all expanded accordion groups */
  expandedGroup(): Locator {
    return this.self().locator('.accordion.has-children.expanded');
  }

  /** Get nested sub-accordions within a group */
  subAccordions(group: Locator): Locator {
    return group.locator('.accordion .accordion');
  }

  /** Get child list (ul) within a group */
  groupChildList(group: Locator): Locator {
    return group.locator('ul');
  }

  /** Get active router links within a group */
  activeLinksInGroup(group: Locator): Locator {
    return group.locator('.router-link-active');
  }

  /** Get all visible child links */
  visibleNavTypes(): Locator {
    return this.self().locator(
      '.accordion.expanded li.nav-type>a, .accordion:not(.has-children):not(.expanded) li.nav-type>a',
    );
  }

  /** Navigate to a side menu group by label */
  async navToSideMenuGroupByLabel(label: string): Promise<void> {
    await this.self().waitFor({ state: 'attached', timeout: LONG });
    await this.self().locator('.accordion.has-children').getByText(label).click();
  }

  /** Get the count badge for a side menu entry */
  async sideMenuEntryByLabelCount(label: string): Promise<string> {
    return await this.sideMenuEntryByLabel(label).locator('..').locator('.count').innerText();
  }

  /** Locator for a side menu entry by exact label text. */
  sideMenuEntryByLabel(label: string): Locator {
    return this.self().locator('.child.nav-type a .label').getByText(label, { exact: true });
  }

  /** Navigate to a side menu entry by label */
  async navToSideMenuEntryByLabel(label: string): Promise<void> {
    // eslint-disable-next-line playwright/no-force-option -- side-nav link can be briefly covered by collapsing accordion / sticky header in tall menus
    await this.sideMenuEntryByLabel(label).click({ force: true });
  }

  /** Get side menu entry locator by label text */
  sideMenuEntryLocator(label: string): Locator {
    return this.self().locator('.child.nav-type a .label').getByText(label);
  }

  /** Get side menu group locator by label text */
  sideMenuGroupLocator(label: string): Locator {
    return this.self().locator('.accordion.has-children').getByText(label);
  }

  /** Get tab headers */
  tabHeaders(): Locator {
    return this.self().locator('.header');
  }

  /** Get version number */
  version(): VersionNumberPo {
    return new VersionNumberPo(this.page, '.side-menu .version');
  }

  /** Get the active navigation item locator */
  activeNavItemLocator(): Locator {
    return this.accordionItems().locator('.router-link-active');
  }

  /** Get the active navigation item text */
  async activeNavItem(): Promise<string> {
    const active = this.activeNavItemLocator();

    await active.waitFor({ state: 'attached' });

    return (await active.innerText()).trim();
  }
}
