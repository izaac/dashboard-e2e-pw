import type { Page, Locator } from '@playwright/test';
import PagePo from '@/e2e/po/pages/page.po';
import AsyncButtonPo from '@/e2e/po/components/async-button.po';
import RadioGroupInputPo from '@/e2e/po/components/radio-group-input.po';
import CheckboxInputPo from '@/e2e/po/components/checkbox-input.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import BaseResourceList from '@/e2e/po/lists/base-resource-list.po';

/**
 * Page object for Cluster and Project Members page.
 */
export default class ClusterProjectMembersPo extends PagePo {
  private static createPath(clusterId: string, tabId: string) {
    return `/c/${clusterId}/explorer/members#${tabId}`;
  }

  constructor(page: Page, clusterId = 'local', tabId = 'cluster-membership') {
    super(page, ClusterProjectMembersPo.createPath(clusterId, tabId));
  }

  async triggerAddClusterOrProjectMemberAction(): Promise<void> {
    await this.page.locator('.btn.role-primary.pull-right').click();
  }

  async triggerAddProjectMemberAction(projectLabel: string): Promise<void> {
    const cleanLabel = projectLabel.replace(' ', '').toLowerCase();

    await this.page.getByTestId(`add-project-member-${cleanLabel}`).click();
  }

  async selectClusterOrProjectMember(name: string): Promise<void> {
    const select = this.page.getByTestId('cluster-member-select');

    await select.click();
    await select.locator('input[type="search"]').fill(name);
    await this.page.locator('.vs__dropdown-menu > li').filter({ hasText: name }).first().click();
  }

  async selectProjectCustomPermission(): Promise<void> {
    const permissionOptions = new RadioGroupInputPo(this.page, '[data-testid="permission-options"]');

    await permissionOptions.checkExists();
    await permissionOptions.set(3);
  }

  async checkTheseProjectCustomPermissions(permissionIndices: number[]): Promise<void> {
    for (const permissionIndex of permissionIndices) {
      const checkbox = new CheckboxInputPo(this.page, `[data-testid="custom-permission-${permissionIndex}"]`);

      await checkbox.checkExists();
      await checkbox.set();
    }
  }

  async submitProjectCreateButton(): Promise<void> {
    await this.page.locator('[data-testid="card-actions-slot"] button.role-primary').click();
  }

  saveCreateForm(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="form-save"]', this.self());
  }

  cancelCreateForm(): AsyncButtonPo {
    return new AsyncButtonPo(this.page, '[data-testid="form-cancel"]', this.self());
  }

  resourcesList(): BaseResourceList {
    return new BaseResourceList(this.page, ':scope', this.self());
  }

  sortableTable(): SortableTablePo {
    return this.resourcesList().resourceTable().sortableTable();
  }

  listElementWithName(name: string): Locator {
    // Cluster member rows contain the username plus the cluster display name (e.g. "Local"),
    // so a partial match is required here rather than exact.
    return this.sortableTable().rowElementWithPartialName(name);
  }

  projectTable(): SortableTablePo {
    return new SortableTablePo(this.page, '#project-membership [data-testid="sortable-table-list-container"]');
  }

  modalOverlay(): Locator {
    return this.page.locator('.modal-overlay');
  }
}
