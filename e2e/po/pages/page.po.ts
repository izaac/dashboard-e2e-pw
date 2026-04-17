import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import ComponentPo from '@/e2e/po/components/component.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';
import { HeaderPo } from '@/e2e/po/components/header.po';

/**
 * Base page object for Playwright.
 * Replaces the Cypress PagePo pattern.
 *
 * Playwright's baseURL + URL() constructor treats '/path' as root-relative,
 * stripping any subpath (e.g. /dashboard). To match Cypress behavior (simple
 * concatenation), goTo() uses the full baseURL + path.
 */
export default class PagePo extends ComponentPo {
  protected path: string;

  constructor(page: Page, path: string, selector = '.dashboard-root') {
    super(page, selector);
    this.path = path;
  }

  /** Build the full URL: baseURL (from config) + this.path */
  protected fullUrl(params?: string, fragment?: string): string {
    return `${this.path}${params ? `?${params}` : ''}${fragment ? `#${fragment}` : ''}`;
  }

  async goTo(params?: string, fragment?: string): Promise<void> {
    // Use '.' prefix so Playwright resolves relative to baseURL (including subpath)
    // e.g. baseURL='https://host/dashboard', path='/auth/login'
    //   → '.' + '/auth/login' = './auth/login'
    //   → resolved to 'https://host/dashboard/auth/login'
    const relativePath = `.${this.fullUrl(params, fragment)}`;

    await this.page.goto(relativePath, { waitUntil: 'domcontentloaded' });
  }

  async waitForPage(params?: string, fragment?: string): Promise<void> {
    const expected = this.fullUrl(params, fragment);

    await expect(this.page).toHaveURL(new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  async waitForPageWithExactUrl(params?: string, fragment?: string): Promise<void> {
    const expected = this.fullUrl(params, fragment);

    await expect(this.page).toHaveURL(new RegExp(`${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  }

  async waitForUrlPathWithoutContext(params?: string, fragment?: string): Promise<void> {
    const pathWithoutContext = this.path.replace(/\/c\/[^/]+\//, '/');
    const expected = `${pathWithoutContext}${params ? `?${params}` : ''}${fragment ? `#${fragment}` : ''}`;

    await expect(this.page).toHaveURL(new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  async isCurrentPage(isExact = true): Promise<boolean> {
    const currentUrl = this.page.url();

    if (isExact) {
      return currentUrl.endsWith(this.path);
    }

    return currentUrl.includes(this.path);
  }

  async checkIsCurrentPage(exact = true): Promise<void> {
    const isCurrent = await this.isCurrentPage(exact);

    expect(isCurrent).toBe(true);
  }

  mastheadTitle(): Locator {
    return this.self().locator('.title-bar h1.title, .primaryheader h1');
  }

  async waitForMastheadTitle(title: string): Promise<void> {
    await expect(this.mastheadTitle()).toContainText(title);
  }

  /** Wait for URL to contain a specific path and optional params */
  async waitForPageWithSpecificUrl(path?: string, params?: string, fragment?: string): Promise<void> {
    const targetPath = path ?? this.path;
    const expected = `${targetPath}${params ? `?${params}` : ''}${fragment ? `#${fragment}` : ''}`;

    await expect(this.page).toHaveURL(new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  /** Navigate to a menu entry in the burger menu (non-cluster) */
  async navToMenuEntry(label: string): Promise<void> {
    const burgerMenu = new BurgerMenuPo(this.page);

    await burgerMenu.toggle();
    await burgerMenu.burgerMenuNavToMenuByLabel(label);
  }

  /** Navigate to a cluster menu entry in the burger menu */
  async navToClusterMenuEntry(label: string): Promise<void> {
    const burgerMenu = new BurgerMenuPo(this.page);

    await burgerMenu.toggle();
    await burgerMenu.burgerMenuNavToClusterByLabel(label);
  }

  /** Navigate to a side menu group by label */
  async navToSideMenuGroupByLabel(label: string): Promise<void> {
    const nav = new ProductNavPo(this.page);

    await nav.navToSideMenuGroupByLabel(label);
  }

  /** Navigate to a side menu entry by label */
  async navToSideMenuEntryByLabel(label: string): Promise<void> {
    const nav = new ProductNavPo(this.page);

    await nav.navToSideMenuEntryByLabel(label);
  }

  /** Get the ProductNavPo instance */
  productNav(): ProductNavPo {
    return new ProductNavPo(this.page);
  }

  /** Get the HeaderPo instance */
  header(): HeaderPo {
    return new HeaderPo(this.page);
  }

  /** Favicon link element in <head> */
  faviconLink(): Locator {
    return this.page.locator('head link[rel="shortcut icon"]');
  }

  /** Get innerHTML of the first <style> tag in <head> */
  async headStyleContent(): Promise<string> {
    return this.page
      .locator('head style')
      .first()
      .evaluate((el) => el.innerHTML);
  }

  /** Check if the fail-whale error page is visible */
  async isFailWhaleVisible(): Promise<boolean> {
    // Some Rancher versions use '.fail-whale', others use '.main-layout.error' or a URL path
    const failWhale = await this.page
      .locator('.fail-whale')
      .isVisible()
      .catch(() => false);
    const errorPage = await this.page
      .locator('.main-layout.error')
      .isVisible()
      .catch(() => false);
    const urlHasFailWhale = this.page.url().includes('fail-whale');

    return failWhale || errorPage || urlHasFailWhale;
  }

  /** Scroll the main content area to the bottom */
  async scrollMainContentToBottom(): Promise<void> {
    await this.page
      .locator('.main-layout > .outlet > .outer-container')
      .evaluate((el) => el.scrollTo(0, el.scrollHeight));
  }

  /** Click away from any open menus/dropdowns by clicking the dashboard root */
  async clickAway(position = { x: 300, y: 300 }): Promise<void> {
    await this.self().click({ position });
  }

  /** Return a locator for <body> (useful for page-wide text assertions) */
  body(): Locator {
    return this.page.locator('body');
  }

  /** Wait for the dashboard root element to be present */
  async waitForDashboardRoot(): Promise<void> {
    await this.page.locator('.dashboard-root').waitFor();
  }

  /** Get extension script import element by name */
  extensionScriptImport(name: string): Locator {
    return this.self().locator(`[data-purpose="extension"] [id*="${name}"]`);
  }
}
