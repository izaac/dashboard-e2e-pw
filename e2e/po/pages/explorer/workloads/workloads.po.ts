import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import LabeledInputPo from '@/e2e/po/components/labeled-input.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';

type WorkloadType =
  | 'workload'
  | 'pods'
  | 'apps.deployments'
  | 'replicasets'
  | 'daemonsets'
  | 'statefulsets'
  | 'jobs'
  | 'cronjobs'
  | 'apps.deployment';

/**
 * Base page object for workload list pages (Deployments, DaemonSets, etc.)
 */
export class WorkloadsListPageBasePo extends PagePo {
  constructor(page: Page, clusterId = 'local', workloadType: WorkloadType, queryParams?: Record<string, string>) {
    const urlStr = `/c/${clusterId}/explorer/${workloadType}`;
    const params = queryParams ? `?${new URLSearchParams(queryParams).toString()}` : '';

    super(page, `${urlStr}${params}`);
  }

  sortableTable(): Locator {
    return this.self().locator('.sortable-table');
  }

  /** SortableTablePo with full component methods (action menus, row selection, etc.) */
  sortableTablePo(): SortableTablePo {
    return new SortableTablePo(this.page, '.sortable-table');
  }

  listElementWithName(name: string): Locator {
    return this.sortableTable().locator(`td.col-link-detail`).filter({ hasText: name });
  }

  async goToEditYamlPage(name: string): Promise<void> {
    await this.rowActionMenuOpen(name);
    await this.page.getByRole('menuitem', { name: 'Edit YAML' }).click();
  }

  async goToEditConfigPage(name: string): Promise<void> {
    await this.rowActionMenuOpen(name);
    await this.page.getByRole('menuitem', { name: 'Edit Config' }).click();
  }

  async deleteItemWithUI(name: string): Promise<void> {
    await this.rowActionMenuOpen(name);
    await this.page.getByRole('menuitem', { name: 'Delete' }).click();

    // Confirm deletion in the prompt
    const promptRemove = this.page.locator(
      '[data-testid="prompt-remove-confirm-button"], .prompt-remove .btn.role-primary',
    );

    await promptRemove.click();
  }

  private async rowActionMenuOpen(name: string): Promise<void> {
    const row = this.sortableTable().locator('tr.main-row').filter({ hasText: name });

    await row
      .locator('button[data-testid$="action-button"], .actions .btn.role-multi-action, button.actions-container')
      .click();
  }

  /** Open the row action menu for a named resource and click a menu item */
  async rowActionMenuClick(name: string, menuItem: string): Promise<void> {
    await this.rowActionMenuOpen(name);
    await this.page.getByRole('menuitem', { name: menuItem }).click();
  }
}

/**
 * Base page object for workload create pages
 */
export class WorkloadsCreatePageBasePo extends PagePo {
  constructor(page: Page, clusterId = 'local', workloadType: WorkloadType, queryParams?: Record<string, string>) {
    const urlStr = `/c/${clusterId}/explorer/${workloadType}/create`;
    const params = queryParams ? `?${new URLSearchParams(queryParams).toString()}` : '';

    super(page, `${urlStr}${params}`);
  }

  nameInput(): Locator {
    return this.page.getByTestId('name-ns-description-name');
  }

  async selectNamespace(label: string): Promise<void> {
    const nsSelect = this.page.getByTestId('name-ns-description-namespace');

    await nsSelect.click();
    await this.page.locator(`.vs__dropdown-menu`).getByRole('option', { name: label, exact: true }).click();
  }

  containerImage(): LabeledInputPo {
    return LabeledInputPo.byLabel(this.page, this.self(), 'Container Image');
  }

  async save(): Promise<void> {
    await this.page.getByTestId('form-save').click();
  }

  containerTab(index = 0): Locator {
    return this.page.locator(`li#container-${index}`);
  }

  podTab(): Locator {
    return this.page.locator('li#pod');
  }

  async addEnvironmentVariable(): Promise<void> {
    await this.page.getByTestId('add-env-var').click();
  }

  environmentVariableKeyInput(index: number): Locator {
    return this.page.getByTestId(`env-var-row-${index}`).locator('.name input');
  }

  environmentVariableValueInput(index: number): Locator {
    return this.page.getByTestId(`env-var-row-${index}`).locator('.single-value input, .single-value textarea');
  }

  async removeEnvironmentVariable(index: number): Promise<void> {
    await this.page.getByTestId(`env-var-row-${index}`).locator('.remove button').click();
  }

  addContainerButton(): Locator {
    return this.page.getByTestId('workload-button-add-container');
  }

  errorBanner(): Locator {
    return this.page.locator('#cru-errors');
  }

  storagePodTab(): Locator {
    return this.page.locator('li#storage-pod');
  }

  addVolumeButton(): Locator {
    return this.page
      .locator('.add-vol button, [data-testid="add-volume-button"]')
      .or(this.page.getByRole('button', { name: 'Add Volume' }))
      .first();
  }

  dropdownMenu(): Locator {
    return this.page.locator('.vs__dropdown-menu');
  }

  /**
   * Create a deployment via the UI form.
   * Fills name, container image, selects namespace, and saves.
   */
  async createWithUI(name: string, containerImage: string, namespace = 'default'): Promise<void> {
    await this.selectNamespace(namespace);

    const nameInput = this.nameInput().locator('input');

    await nameInput.scrollIntoViewIfNeeded();
    await nameInput.clear();
    await nameInput.fill(name);

    await this.containerImage().set(containerImage);
    await this.save();
  }
}

/**
 * Base page object for workload detail pages
 */
export class WorkloadDetailsPageBasePo extends PagePo {
  constructor(
    page: Page,
    workloadId: string,
    clusterId: string,
    workloadType: WorkloadType,
    namespaceId = 'default',
    queryParams?: Record<string, string>,
  ) {
    const urlStr = `/c/${clusterId}/explorer/${workloadType}/${namespaceId}/${workloadId}`;
    const params = queryParams ? `?${new URLSearchParams(queryParams).toString()}` : '';

    super(page, `${urlStr}${params}`);
  }

  title(): Locator {
    return this.self().locator('h1');
  }
}
