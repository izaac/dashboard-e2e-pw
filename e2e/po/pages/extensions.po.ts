import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import ResourceTablePo from '@/e2e/po/components/resource-table.po';
import ActionMenuPo from '@/e2e/po/components/action-menu.po';
import ComponentPo from '@/e2e/po/components/component.po';
import BannersPo from '@/e2e/po/components/banners.po';

// --------------- Install Extension Dialog ---------------

class InstallExtensionDialog {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  self(): Locator {
    return this.page.locator('#modal-container-element');
  }

  async checkVisible(): Promise<void> {
    await expect(this.self()).toBeVisible();
  }

  versionLabelSelect(): LabeledSelectPo {
    return new LabeledSelectPo(this.page, '[data-testid="install-ext-modal-select-version"]', this.self());
  }

  async selectVersionLabel(label: string): Promise<void> {
    const selectVersion = this.versionLabelSelect();

    await selectVersion.dropdown().click();
    await selectVersion.setOptionAndClick(label);
  }

  installButton(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="install-ext-modal-install-btn"]', this.self());
  }

  cancelButton(): Locator {
    return this.self().getByTestId('install-ext-modal-cancel-btn');
  }

  async selectVersionClick(optionIndex: number, toggle = true): Promise<void> {
    const selectVersion = this.versionLabelSelect();

    if (toggle) {
      await selectVersion.dropdown().click();
    }

    await selectVersion.optionByIndex(optionIndex).click();
  }

  async getOptionsAsStrings(): Promise<string[]> {
    const selectVersion = this.versionLabelSelect();
    const options = selectVersion.getOptions();
    const count = await options.count();
    const texts: string[] = [];

    for (let i = 0; i < count; i++) {
      texts.push((await options.nth(i).innerText()).trim());
    }

    return texts;
  }
}

// --------------- Extensions Page ---------------

export default class ExtensionsPagePo extends PagePo {
  extensionTabs: TabbedPo;

  constructor(page: Page) {
    super(page, '/c/local/uiplugins');
    this.extensionTabs = new TabbedPo(page, '[data-testid="extension-tabs"]');
  }

  title(): Locator {
    return this.self().getByTestId('extensions-page-title');
  }

  async waitForTitle(): Promise<void> {
    await expect(this.title()).toContainText('Extensions');
  }

  // --- extension card helpers ---

  extensionCard(extensionTitle: string): Locator {
    return this.page.locator('div.item-card').filter({
      has: this.page.locator(`[data-testid="item-card-header-title"]:has-text("${extensionTitle}")`),
    });
  }

  extensionCardVersion(extensionTitle: string): Locator {
    return this.extensionCard(extensionTitle).locator('[data-testid="app-chart-card-sub-header-item"]').first();
  }

  extensionCardHeaderStatusIcon(extensionTitle: string, index: number): Locator {
    return this.extensionCard(extensionTitle).getByTestId(`item-card-header-status-${index}`);
  }

  /**
   * Hover over a status icon and wait for its tooltip to contain the expected text.
   */
  async extensionCardHeaderStatusTooltipText(
    extensionTitle: string,
    index: number,
    expectedText: string,
  ): Promise<void> {
    const icon = this.extensionCardHeaderStatusIcon(extensionTitle, index);

    await icon.hover();
    const tooltip = this.page.locator('.v-popper__popper .v-popper__inner');

    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(expectedText);
  }

  private async clickAction(extensionTitle: string, actionLabel: string): Promise<void> {
    const card = this.extensionCard(extensionTitle);

    await card.locator('[data-testid="item-card-header-action-menu"]').click();
    await this.page.locator('[dropdown-menu-item]').filter({ hasText: actionLabel }).click();
  }

  async extensionCardClick(extensionTitle: string): Promise<void> {
    await this.extensionCard(extensionTitle).click();
  }

  async extensionCardInstallClick(extensionTitle: string): Promise<void> {
    await this.clickAction(extensionTitle, 'Install');
  }

  async extensionCardUpgradeClick(extensionTitle: string): Promise<void> {
    await this.clickAction(extensionTitle, 'Upgrade');
  }

  async extensionCardDowngradeClick(extensionTitle: string): Promise<void> {
    await this.clickAction(extensionTitle, 'Downgrade');
  }

  async extensionCardUninstallClick(extensionTitle: string): Promise<void> {
    await this.clickAction(extensionTitle, 'Uninstall');
  }

  installModal(): InstallExtensionDialog {
    return new InstallExtensionDialog(this.page);
  }

  // --- extension uninstall modal ---

  extensionUninstallModal(): Locator {
    return this.page.getByTestId('uninstall-extension-modal');
  }

  async uninstallModalUninstallClick(): Promise<void> {
    await this.extensionUninstallModal().getByTestId('uninstall-ext-modal-uninstall-btn').click();
  }

  // --- extension details ---

  extensionDetails(): Locator {
    return this.page.getByTestId('extension-details');
  }

  extensionDetailsTitle(): Locator {
    return this.extensionDetails().getByTestId('extension-details-title');
  }

  extensionDetailsVersion(): Locator {
    return this.extensionDetails().locator('.version-link');
  }

  async extensionDetailsCloseClick(): Promise<void> {
    // The close button can be outside the viewport or behind the fixed header,
    // so use Escape key which the panel natively handles
    await this.page.keyboard.press('Escape');
  }

  async extensionDetailsBgClick(): Promise<void> {
    await this.page.getByTestId('extension-details-bg').click();
  }

  loading(): Locator {
    return this.self().locator('.data-loading');
  }

  extensionCardPo(extensionTitle: string): ComponentPo {
    return new ComponentPo(
      this.page,
      `div.item-card:has([data-testid="item-card-header-title"]:has-text("${extensionTitle}"))`,
    );
  }

  catalogsList(): ResourceTablePo {
    return new ResourceTablePo(this.page, '[data-testid="sortable-table-list-container"]');
  }

  async addRepositoriesClick(): Promise<void> {
    const actionMenu = new ActionMenuPo(this.page);

    await actionMenu.getMenuItem('Add Rancher Repositories').click();
  }

  async manageExtensionCatalogsClick(): Promise<void> {
    const actionMenu = new ActionMenuPo(this.page);

    await actionMenu.getMenuItem('Manage Extension Catalogs').click();
  }

  // --- extension tabs ---

  async waitForTabs(): Promise<void> {
    await this.extensionTabs.checkVisible();
  }

  extensionTabBuiltin(): Locator {
    return this.extensionTabs.tabByTestId('builtin');
  }

  async checkForExtensionTab(tab: 'available' | 'installed' | 'builtin'): Promise<boolean> {
    await this.waitForTabs();

    return await this.page
      .getByTestId(`btn-${tab}`)
      .isVisible()
      .catch(() => false);
  }

  async checkForExtensionCardWithName(extensionName: string): Promise<boolean> {
    await this.waitForTabs();
    const cards = this.page.locator('[data-testid="item-card-header-title"]');
    const count = await cards.count();

    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).innerText();

      if (text.includes(extensionName)) {
        return true;
      }
    }

    return false;
  }

  async extensionTabInstalledClick(): Promise<void> {
    await this.extensionTabs.tab('installed').click();
  }

  async extensionTabAvailableClick(): Promise<void> {
    await this.extensionTabs.tab('available').click();
  }

  async extensionTabBuiltinClick(): Promise<void> {
    await this.extensionTabs.tab('builtin').click();
  }

  // --- extension reload banner ---

  extensionReloadBanner(): Locator {
    return this.page.getByTestId('extension-reload-banner');
  }

  async extensionReloadClick(): Promise<void> {
    await this.extensionReloadBanner().getByTestId('extension-reload-banner-reload-btn').click();
  }

  // --- repos banner ---

  repoBanner(): BannersPo {
    return new BannersPo(this.page, '[data-testid="extensions-new-repos-banner"]', this.self());
  }

  repoBannerActionButton(): Locator {
    return this.self().getByTestId('extensions-new-repos-banner-action-btn');
  }

  // --- add repos modal ---

  addReposModal(): Locator {
    return this.page.getByTestId('add-extensions-repos-modal');
  }

  addReposModalPartnersCheckbox(): Locator {
    return this.addReposModal().getByTestId('add-extensions-repos-modal-add-partners-repo');
  }

  async addReposModalAddClick(): Promise<void> {
    // Wait for modal fetch() to complete — checkboxes are disabled while pending
    await expect(this.addReposModalPartnersCheckbox()).toBeEnabled();
    await this.addReposModal().locator('.dialog-buttons button:last-child').click();
  }

  // --- extension script import ---

  extensionScriptImport(extensionName: string): Locator {
    return this.page.locator(`[id*="${extensionName}"]`);
  }

  // --- extension menu ---

  async extensionMenuToggle(): Promise<void> {
    await this.page.getByTestId('extensions-page-menu').click();
  }

  async manageReposClick(): Promise<void> {
    const actionMenu = new ActionMenuPo(this.page);

    await actionMenu.getMenuItem('Manage Repositories').click();
  }

  // --- install extension from catalog (helper) ---

  async installExtensionFromCatalog(extensionName: string): Promise<void> {
    await this.extensionTabAvailableClick();
    await this.waitForPage(undefined, 'available');
    await this.extensionCardInstallClick(extensionName);
    await this.installModal().checkVisible();
    await this.installModal().installButton().click();
    await expect(this.extensionReloadBanner()).toBeVisible({ timeout: 60000 });
    await this.extensionReloadClick();
  }

  // --- add extensions repo direct link (used in elemental spec) ---

  async addExtensionsRepositoryDirectLink(
    repo: string,
    branch: string,
    name: string,
    waitForActiveState = true,
  ): Promise<void> {
    // Check if repo already exists via API before attempting UI creation
    const apiResp = await this.page.request.get(`v1/catalog.cattle.io.clusterrepos/${name}`, {
      failOnStatusCode: false,
    });

    if (apiResp.status() === 200) {
      // Repo already exists — nothing to do
      return;
    }

    // Navigate to cluster repo create page
    await this.page.goto('./c/local/apps/catalog.cattle.io.clusterrepo/create', { waitUntil: 'domcontentloaded' });
    await expect(this.page).toHaveURL(/create/);

    // Fill the name
    const nameInput = this.page.locator('[data-testid="name-ns-description-name"] input');

    await nameInput.scrollIntoViewIfNeeded();
    await expect(nameInput).toBeVisible();
    await nameInput.fill(name);

    // Select git repo card
    await this.page.locator('[data-testid="item-card-git-repo"]').click();

    // Fill git repo URL and branch (wait for git form to render after card selection)
    const gitRepoInput = this.page.getByTestId('clusterrepo-git-repo-input');

    await expect(gitRepoInput).toBeVisible();
    await gitRepoInput.fill(repo);
    await this.page.getByTestId('clusterrepo-git-branch-input').fill(branch);

    // Click create
    await this.page.locator('[data-testid="action-button-async-button"]').click();

    if (waitForActiveState) {
      await expect(this.page).toHaveURL(/catalog\.cattle\.io\.clusterrepo/, { timeout: 30000 });
      await expect(
        this.page.locator('tbody tr').filter({ hasText: name }).locator('td.col-badge-state-formatter'),
      ).toContainText('Active', { timeout: 60000 });
    }
  }
}
