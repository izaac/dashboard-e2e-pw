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
    await this.page.getByTestId('button-cluster-member-add').click();
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

    await permissionOptions.self().waitFor({ state: 'attached' });
    await permissionOptions.set(3);
  }

  async checkTheseProjectCustomPermissions(permissionIndices: number[]): Promise<void> {
    for (const permissionIndex of permissionIndices) {
      const checkbox = new CheckboxInputPo(this.page, `[data-testid="custom-permission-${permissionIndex}"]`);

      await checkbox.self().waitFor({ state: 'attached' });
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
    return new SortableTablePo(this.page, '#cluster-membership .sortable-table');
  }

  listElementWithName(name: string): Locator {
    return this.sortableTable().rowElementWithName(name);
  }

  /** Get the displayed member name cell within a row (resolves principal display name). */
  memberNameInRow(row: Locator): Locator {
    return row.locator('.principal .name');
  }

  projectTable(): SortableTablePo {
    return new SortableTablePo(this.page, '#project-membership [data-testid="sortable-table-list-container"]');
  }

  projectMembershipTab(): Locator {
    return this.page.getByTestId('btn-project-membership');
  }

  clusterMembershipTab(): Locator {
    return this.page.getByTestId('btn-cluster-membership');
  }

  clusterMembershipPanel(): Locator {
    return this.page.getByTestId('tab-panel-cluster-membership');
  }

  /** Tab panel that holds the Project Membership table (stable test id, the section id is generated). */
  projectMembershipPanel(): Locator {
    return this.page.getByTestId('tab-panel-project-membership');
  }

  /** Unresolved principal row name, e.g. "github_team 8087745" (the principal id with "://" replaced by a space). */
  unresolvedPrincipal(name: string, scope?: Locator): Locator {
    return (scope ?? this.projectMembershipPanel()).locator('.name.unresolved').filter({ hasText: name }).first();
  }

  /** Resolved principal container matching the given text. */
  resolvedPrincipal(name: string, scope?: Locator): Locator {
    return (scope ?? this.projectMembershipPanel()).locator('.principal').filter({ hasText: name }).first();
  }

  /** Name element inside a principal container. */
  principalName(principal: Locator): Locator {
    return principal.locator('.name');
  }

  /** Question mark icon inside a principal container. */
  principalQuestionMarkIn(principal: Locator): Locator {
    return principal.locator('.icon-question-mark');
  }

  /** Question mark avatar rendered for a principal whose details could not be resolved. */
  principalQuestionMark(name: string, scope?: Locator): Locator {
    return (scope ?? this.projectMembershipPanel())
      .locator('.principal')
      .filter({ hasText: name })
      .first()
      .locator('.icon-question-mark');
  }

  /** Info icon button beside an unresolved principal name that shows why the id is displayed. */
  principalInfoIcon(name: string, scope?: Locator): Locator {
    return (scope ?? this.projectMembershipPanel())
      .locator('.name.unresolved')
      .filter({ hasText: name })
      .first()
      .locator('button.rc-icon-tooltip');
  }

  /** Floating tooltip shown on hover/focus. */
  tooltip(): Locator {
    return this.page.locator('[role="tooltip"]').first();
  }

  /** Table rows (one per binding) inside a membership panel. */
  membershipRows(panel: Locator): Locator {
    return panel.locator('[data-testid^="sortable-table-"][data-testid$="-row"]');
  }

  /** Row whose principal cell contains the given text. */
  membershipRowWithText(panel: Locator, text: string | RegExp): Locator {
    return this.membershipRows(panel).filter({ hasText: text });
  }

  /** Principal container (avatar, name, description) inside a membership row. */
  principalInRow(row: Locator): Locator {
    return row.locator('.principal');
  }

  /** All principal name elements (resolved or not) in a panel. */
  principalNames(panel: Locator): Locator {
    return panel.locator('.principal .name');
  }

  /** Principal name elements that fell back to showing the raw principal id. */
  unresolvedPrincipalNames(panel: Locator): Locator {
    return panel.locator('div.name.unresolved');
  }

  /** Avatar images of resolved principals in a panel. */
  principalAvatarImages(panel: Locator): Locator {
    return panel.locator('div.principal > div.avatar > img');
  }

  /** Description line ("Local") of a principal container. */
  principalDescription(principal: Locator): Locator {
    return principal.locator('div.description');
  }

  /**
   * Make every lookup of a single principal by id (GET /v3/principals/<id>) fail, leaving the
   * principal search calls (/v3/principals?action=search) untouched.
   * `forbid` answers 403, `abort` kills the request like DevTools "Block request URL".
   */
  async failPrincipalLookups(mode: 'forbid' | 'abort'): Promise<{ hits: () => number }> {
    let hits = 0;

    await this.page.route('**/v3/principals/**', async (route) => {
      const request = route.request();

      if (request.method() !== 'GET') {
        return route.fallback();
      }

      hits++;

      if (mode === 'abort') {
        return route.abort('failed');
      }

      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'error',
          status: 403,
          code: 'Forbidden',
          message: 'forbidden by e2e route',
        }),
      });
    });

    return { hits: () => hits };
  }

  modalOverlay(): Locator {
    return this.page.locator('.modal-overlay');
  }
}
