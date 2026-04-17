import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import VersionNumberPo from '@/e2e/po/components/version-number.po';

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
      '.accordion.expanded li.nav-type>a, .accordion:not(.has-children):not(.expanded) li.nav-type>a'
    );
  }

  /** Navigate to a side menu group by label */
  async navToSideMenuGroupByLabel(label: string): Promise<void> {
    await expect(this.self()).toBeAttached({ timeout: 30000 });
    await this.self().locator('.accordion.has-children').getByText(label).click();
  }

  /** Get the count badge for a side menu entry */
  async sideMenuEntryByLabelCount(label: string): Promise<string> {
    const entry = await this.sideMenuEntryByLabel(label);

    return await entry.locator('..').locator('.count').innerText();
  }

  /** Find a side menu entry by exact label text */
  async sideMenuEntryByLabel(label: string): Promise<Locator> {
    await expect(this.self()).toBeAttached({ timeout: 30000 });

    const labels = this.self().locator('.child.nav-type a .label');
    const count = await labels.count();

    for (let i = 0; i < count; i++) {
      const text = await labels.nth(i).innerText();

      if (text.trim() === label) {
        return labels.nth(i);
      }
    }

    // Fallback: return the first matching element
    return labels.getByText(label, { exact: true });
  }

  /** Navigate to a side menu entry by label */
  async navToSideMenuEntryByLabel(label: string): Promise<void> {
    const entry = await this.sideMenuEntryByLabel(label);

    await entry.click({ force: true });
  }

  /** Check existence of menu side entry */
  async checkSideMenuEntryByLabel(label: string, shouldExist: boolean): Promise<void> {
    const entry = this.self().locator('.child.nav-type a .label').getByText(label);

    if (shouldExist) {
      await expect(entry).toBeAttached();
    } else {
      await expect(entry).not.toBeAttached();
    }
  }

  /** Check existence of menu group by label */
  async navToSideMenuGroupByLabelExistence(label: string, shouldExist: boolean): Promise<void> {
    const group = this.self().locator('.accordion.has-children').getByText(label);

    if (shouldExist) {
      await expect(group).toBeAttached();
    } else {
      await expect(group).not.toBeAttached();
    }
  }

  /** Get tab headers */
  tabHeaders(): Locator {
    return this.self().locator('.header');
  }

  /** Get version number */
  version(): VersionNumberPo {
    return new VersionNumberPo(this.page, '.side-menu .version');
  }

  /** Get the active navigation item text */
  async activeNavItem(): Promise<string> {
    const active = this.accordionItems().locator('.router-link-active');

    await expect(active).toBeAttached();

    return (await active.innerText()).trim();
  }
}
