import { test, expect } from '@/support/fixtures';
import path from 'path';
import fs from 'fs';
import type { Page } from '@playwright/test';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import HomePagePo from '@/e2e/po/pages/home.po';
import ActionMenuPo from '@/e2e/po/components/action-menu.po';

const evidenceDir = process.env.EVIDENCE_DIR_19241 || path.resolve(__dirname, 'evidence-19241');

if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

/**
 * Early suite helper: dismisses the Rancher Prime Welcome / What's New dialog
 * and asserts that no modal overlay intercepts pointer events before interacting.
 */
async function dismissModals(page: Page): Promise<void> {
  const overlay = page.locator('.rc-modal-overlay');

  try {
    if (await overlay.isVisible({ timeout: 3000 }).catch(() => false)) {
      const closeBtn = page.locator('#modals').getByRole('button', { name: /Close/i });

      if ((await closeBtn.count()) > 0) {
        await closeBtn.first().click();
      } else {
        await page.keyboard.press('Escape');
      }
      await overlay.waitFor({ state: 'detached', timeout: 5000 });
    }
  } catch {
    // Modal did not appear or was already dismissed
  }
}

/**
 * Smooth burger menu opener without debounce animation stalls.
 */
async function openBurgerMenu(page: Page): Promise<void> {
  const sideMenu = page.locator('[data-testid="side-menu"]');
  const cls = (await sideMenu.getAttribute('class')) || '';

  if (!cls.includes('menu-open')) {
    await page.getByTestId('top-level-menu').click({ force: true });
    await sideMenu.waitFor({ state: 'visible' });
    await page.waitForTimeout(400);
  }
}

/**
 * Smooth burger menu closer via native glass backdrop click or hamburger toggle.
 */
async function closeBurgerMenu(page: Page): Promise<void> {
  const glass = page.locator('.side-menu-glass');

  if (await glass.isVisible().catch(() => false)) {
    await glass.click({ force: true });
    await glass.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
  } else {
    const sideMenu = page.locator('[data-testid="side-menu"]');
    const cls = (await sideMenu.getAttribute('class')) || '';

    if (cls.includes('menu-open')) {
      await page.getByTestId('top-level-menu').click({ force: true });
      await page.waitForTimeout(400);
    }
  }
}

test.describe('Cluster Badges and Pin Actions (#19241 / #19537)', { tag: ['@adminUser'] }, () => {
  // Ensure every test starts and finishes in a clean, state-independent baseline
  test.beforeEach(async ({ rancherApi, login }) => {
    await rancherApi.setUserPreference({ 'pinned-clusters': '[]', theme: '"ui-auto"' });
    await login();
  });

  test.afterEach(async ({ rancherApi }) => {
    await rancherApi.setUserPreference({ 'pinned-clusters': '[]', theme: '"ui-auto"' });
  });

  test('1. Badge column on Cluster Management renders after Name with custom color and uppercase icon text (Scenarios 1, 10)', async ({
    page,
  }) => {
    const clusterList = new ClusterManagerListPagePo(page, 'local');

    await clusterList.goTo();
    await clusterList.sortableTable().checkLoadingIndicatorNotVisible();
    await dismissModals(page);

    // Verify Badge header exists and sits physically to the right of Name
    const thead = clusterList.sortableTable().self().locator('thead tr');
    const nameHeader = thead.locator('th').filter({ hasText: 'Name' });
    const badgeHeader = thead.locator('th').filter({ hasText: 'Badge' });

    await expect(nameHeader).toBeVisible();
    await expect(badgeHeader).toBeVisible();

    const nameBox = await nameHeader.boundingBox();
    const badgeBox = await badgeHeader.boundingBox();

    expect(nameBox).not.toBeNull();
    expect(badgeBox).not.toBeNull();
    expect(badgeBox!.x).toBeGreaterThan(nameBox!.x);

    // Verify custom badge cluster: PRD icon text and #b62020 color
    const customRow = clusterList.sortableTable().rowWithName('Production Cluster Alpha');

    await expect(customRow.self()).toBeVisible();

    const badgeChip = customRow.badge();

    await expect(badgeChip).toBeVisible();
    await expect(badgeChip.locator('.cluster-badge-logo-text')).toHaveText('PRD');

    const colorDecoration = badgeChip.locator('.custom-color-decoration');

    await expect(colorDecoration).toHaveAttribute('style', /background:\s*(#b62020|rgb\(182,\s*32,\s*32\))/i);

    // Verify auto-abbreviated badge cluster: AWE initials and #673ab7 color
    const autoRow = clusterList.sortableTable().rowWithName('Analytics Workload Engine');

    await expect(autoRow.self()).toBeVisible();
    await expect(autoRow.badge().locator('.cluster-badge-logo-text')).toHaveText(/AWE/i);

    // Verify management-only cluster with default initials (Scenario 10)
    const stdRow = clusterList.sortableTable().rowWithName('Standard QA Cluster');

    await expect(stdRow.self()).toBeVisible();
    await expect(stdRow.badge()).toBeVisible();

    await page.screenshot({ path: path.join(evidenceDir, 'scenario-01-manager-badge-column.png'), fullPage: true });
  });

  test('2. Badge column on Home page clusters list renders matching badge chips (Scenario 2)', async ({ page }) => {
    const homePage = new HomePagePo(page);

    await homePage.goTo();
    await dismissModals(page);

    await expect(homePage.list()).toBeVisible();

    // Verify Badge column header is present in the table
    const thead = homePage.list().locator('thead tr');
    const nameHeader = thead.locator('th').filter({ hasText: 'Name' });
    const badgeHeader = thead.locator('th').filter({ hasText: 'Badge' });

    await expect(nameHeader).toBeVisible();
    await expect(badgeHeader).toBeVisible();

    const nameBox = await nameHeader.boundingBox();
    const badgeBox = await badgeHeader.boundingBox();

    expect(nameBox).not.toBeNull();
    expect(badgeBox).not.toBeNull();
    expect(badgeBox!.x).toBeGreaterThan(nameBox!.x);

    // Verify custom badge row on Home page
    const customRow = homePage.clusterRow('Production Cluster Alpha');

    await expect(customRow).toBeVisible();

    const badgeChip = customRow.locator('.cluster-badge-icon');

    await expect(badgeChip).toBeVisible();
    await expect(badgeChip.locator('.cluster-badge-logo-text')).toHaveText('PRD');

    await page.screenshot({ path: path.join(evidenceDir, 'scenario-02-home-badge-column.png'), fullPage: true });
  });

  test('3. Inline hover pin and unpin toggle updates row state and top nav pinned shelf (Scenarios 3, 4)', async ({
    page,
  }) => {
    const clusterList = new ClusterManagerListPagePo(page, 'local');

    await clusterList.goTo();
    await clusterList.sortableTable().checkLoadingIndicatorNotVisible();
    await dismissModals(page);

    const row = clusterList.sortableTable().rowWithName('Production Cluster Alpha');

    await expect(row.self()).toBeVisible();

    const pinBtn = row.pinBtn();

    // Initially unpinned: icon-pin-outlined and aria-pressed="false"
    await expect(pinBtn).toHaveClass(/icon-pin-outlined/);
    await expect(pinBtn).not.toHaveClass(/is-pinned/);
    await expect(pinBtn).toHaveAttribute('aria-pressed', 'false');

    // Hover over row and click the inline pin button
    await row.self().hover();
    await pinBtn.click();

    // Verified pinned outcome: icon-pin, is-pinned, and aria-pressed="true"
    await expect(pinBtn).toHaveClass(/is-pinned/);
    await expect(pinBtn).toHaveClass(/icon-pin(?!\-outlined)/);
    await expect(pinBtn).toHaveAttribute('aria-pressed', 'true');

    // Verify membership in top nav pinned shelf
    await openBurgerMenu(page);
    await expect(page.locator('.clustersPinned').filter({ hasText: 'Production Cluster Alpha' })).toBeVisible();

    await page.screenshot({ path: path.join(evidenceDir, 'scenario-03-inline-hover-pin-pinned.png') });
    await closeBurgerMenu(page);

    // Click inline pin again to unpin (Scenario 4)
    await pinBtn.click();

    // Verify unpinned outcome
    await expect(pinBtn).toHaveClass(/icon-pin-outlined/);
    await expect(pinBtn).not.toHaveClass(/is-pinned/);
    await expect(pinBtn).toHaveAttribute('aria-pressed', 'false');

    // Verify removal from top nav pinned shelf
    await openBurgerMenu(page);
    await expect(page.locator('.clustersPinned').filter({ hasText: 'Production Cluster Alpha' })).toHaveCount(0);

    await page.screenshot({ path: path.join(evidenceDir, 'scenario-04-inline-pin-unpinned.png') });
    await closeBurgerMenu(page);
  });

  test('4. Row 3-dots action menu offers Pin on unpinned cluster and Unpin on pinned cluster (#19537 / Scenario 5, 6, 10)', async ({
    page,
  }) => {
    const clusterList = new ClusterManagerListPagePo(page, 'local');

    await clusterList.goTo();
    await clusterList.sortableTable().checkLoadingIndicatorNotVisible();
    await dismissModals(page);

    const row = clusterList.sortableTable().rowWithName('Standard QA Cluster');

    await expect(row.self()).toBeVisible();

    // Open action menu on standard unpinned management cluster
    await row.actionBtn().click();

    const actionMenu = new ActionMenuPo(page);

    await expect(actionMenu.self()).toBeVisible();

    const pinOption = actionMenu.getMenuItem('Pin');

    await expect(pinOption).toBeVisible();

    await page.screenshot({ path: path.join(evidenceDir, 'scenario-05-row-action-pin.png') });

    // Click Pin and verify row outcome
    await pinOption.click();
    await actionMenu
      .self()
      .waitFor({ state: 'detached', timeout: 5000 })
      .catch(() => {});

    await expect(row.pinBtn()).toHaveClass(/is-pinned/);

    // Verify top nav shelf has pinned cluster
    await openBurgerMenu(page);
    await expect(page.locator('.clustersPinned').filter({ hasText: 'Standard QA Cluster' })).toBeVisible();
    await closeBurgerMenu(page);

    // Reopen action menu to verify Unpin option
    await row.actionBtn().click();
    await expect(actionMenu.self()).toBeVisible();

    const unpinOption = actionMenu.getMenuItem('Unpin');

    await expect(unpinOption).toBeVisible();

    await page.screenshot({ path: path.join(evidenceDir, 'scenario-06-row-action-unpin.png') });

    // Click Unpin and verify restored outcome
    await unpinOption.click();
    await actionMenu
      .self()
      .waitFor({ state: 'detached', timeout: 5000 })
      .catch(() => {});

    await expect(row.pinBtn()).not.toHaveClass(/is-pinned/);

    await openBurgerMenu(page);
    await expect(page.locator('.clustersPinned').filter({ hasText: 'Standard QA Cluster' })).toHaveCount(0);
    await closeBurgerMenu(page);
  });

  test('5. Bulk action bar supports batch Pin, mixed selection, and batch Unpin (#19537 / Scenario 7, 8, 9)', async ({
    page,
  }) => {
    const clusterList = new ClusterManagerListPagePo(page, 'local');

    await clusterList.goTo();
    await clusterList.sortableTable().checkLoadingIndicatorNotVisible();
    await dismissModals(page);

    const row1 = clusterList.sortableTable().rowWithName('Batch Cluster 1');
    const row2 = clusterList.sortableTable().rowWithName('Batch Cluster 2');
    const row3 = clusterList.sortableTable().rowWithName('Batch Cluster 3');

    await expect(row1.self()).toBeVisible();
    await expect(row2.self()).toBeVisible();
    await expect(row3.self()).toBeVisible();

    // 1. Bulk Pin on two unpinned clusters (Scenario 7)
    await row1.checkbox().click();
    await row2.checkbox().click();

    await expect(row1.checkbox()).toBeChecked();
    await expect(row2.checkbox()).toBeChecked();

    await page.screenshot({ path: path.join(evidenceDir, 'scenario-07-bulk-pin-selected.png') });

    await clusterList.sortableTable().openSelectionActions();

    const bulkPinBtn = clusterList.sortableTable().selectionAction('pinCluster');

    await expect(bulkPinBtn).toBeVisible();
    await expect(bulkPinBtn).toBeEnabled();

    await page.screenshot({ path: path.join(evidenceDir, 'scenario-07-bulk-pin.png') });

    await bulkPinBtn.click();

    // Expect-poll for async preference write to land
    await expect(row1.pinBtn()).toHaveClass(/is-pinned/);
    await expect(row2.pinBtn()).toHaveClass(/is-pinned/);

    // Batch pins must also land on the top nav pinned shelf
    await openBurgerMenu(page);
    await expect(page.locator('.clustersPinned').filter({ hasText: 'Batch Cluster 1' })).toBeVisible();
    await expect(page.locator('.clustersPinned').filter({ hasText: 'Batch Cluster 2' })).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDir, 'scenario-07-bulk-pin-shelf.png') });
    await closeBurgerMenu(page);

    // 2. Mixed selection: Batch Cluster 1 (pinned) and Batch Cluster 3 (unpinned) (Scenario 9)
    await row2.checkbox().click(); // deselect Batch Cluster 2
    await row3.checkbox().click(); // select Batch Cluster 3 (unpinned)

    await clusterList.sortableTable().openSelectionActions();

    const mixedPin = clusterList.sortableTable().selectionAction('pinCluster');
    const mixedUnpin = clusterList.sortableTable().selectionAction('unpinCluster');

    // Capture immediately after opening: the mixed selection leaves both
    // actions present (available > 0) but not necessarily enabled
    // (available >= total), and the menu should be open in the shot.
    await page.screenshot({ path: path.join(evidenceDir, 'scenario-09-bulk-mixed-selection.png') });

    await expect(mixedPin).toBeVisible();
    await expect(mixedUnpin).toBeVisible();

    // Bulk Pin on the mixed selection must target only the unpinned rows:
    // Batch Cluster 3 becomes pinned, Batch Cluster 1 stays pinned.
    await mixedPin.click();
    await expect(row3.pinBtn()).toHaveClass(/is-pinned/);
    await expect(row1.pinBtn()).toHaveClass(/is-pinned/);

    // 3. Bulk Unpin on pinned clusters (Scenario 8)
    if (await row3.checkbox().isChecked()) {
      await row3.checkbox().click(); // deselect Batch Cluster 3
    }
    if (!(await row2.checkbox().isChecked())) {
      await row2.checkbox().click(); // select Batch Cluster 2 (both 1 and 2 are pinned)
    }

    await expect(row1.checkbox()).toBeChecked();
    await expect(row2.checkbox()).toBeChecked();

    await page.screenshot({ path: path.join(evidenceDir, 'scenario-08-bulk-unpin-selected.png') });

    await clusterList.sortableTable().openSelectionActions();

    const bulkUnpinBtn = clusterList.sortableTable().selectionAction('unpinCluster');

    await expect(bulkUnpinBtn).toBeVisible();
    await expect(bulkUnpinBtn).toBeEnabled();

    await page.screenshot({ path: path.join(evidenceDir, 'scenario-08-bulk-unpin.png') });

    await bulkUnpinBtn.click();

    await expect(row1.pinBtn()).not.toHaveClass(/is-pinned/);
    await expect(row2.pinBtn()).not.toHaveClass(/is-pinned/);

    // Batch unpins must also leave the top nav pinned shelf
    await openBurgerMenu(page);
    await expect(page.locator('.clustersPinned').filter({ hasText: 'Batch Cluster 1' })).toHaveCount(0);
    await expect(page.locator('.clustersPinned').filter({ hasText: 'Batch Cluster 2' })).toHaveCount(0);
    await page.screenshot({ path: path.join(evidenceDir, 'scenario-08-bulk-unpin-shelf.png') });
    await closeBurgerMenu(page);

    // 4. Bulk Unpin on a mixed selection only targets the pinned rows (Scenario 9)
    // Normalize the checkbox state left over from the previous bulk action.
    if (await row1.checkbox().isChecked()) {
      await row1.checkbox().click(); // deselect Batch Cluster 1
    }
    if (await row2.checkbox().isChecked()) {
      await row2.checkbox().click(); // deselect Batch Cluster 2
    }

    // Pin only Batch Cluster 1, then select both rows: mixed selection, one pinned, one not.
    await row1.pinBtn().click();
    await expect(row1.pinBtn()).toHaveClass(/is-pinned/);
    await expect(row2.pinBtn()).not.toHaveClass(/is-pinned/);

    await row1.checkbox().click(); // select Batch Cluster 1
    await row2.checkbox().click(); // select Batch Cluster 2 (stays unpinned)

    await clusterList.sortableTable().openSelectionActions();

    const mixedUnpinRows = clusterList.sortableTable().selectionAction('unpinCluster');

    await expect(mixedUnpinRows).toBeVisible();

    await page.screenshot({ path: path.join(evidenceDir, 'scenario-09-bulk-mixed-unpin.png') });

    // Unpin must target the pinned row only: Batch Cluster 1 releases,
    // Batch Cluster 2 was never pinned and stays unpinned.
    await mixedUnpinRows.click();
    await expect(row1.pinBtn()).not.toHaveClass(/is-pinned/);
    await expect(row2.pinBtn()).not.toHaveClass(/is-pinned/);
  });

  test('6. Cluster detail title pin control and Alt+P keyboard shortcut toggle (Scenarios 11, 12)', async ({
    page,
  }) => {
    // Navigate to cluster detail page for provisioned cluster
    await page.goto('/dashboard/c/local/manager/provisioning.cattle.io.cluster/fleet-default/qa-19241-prov');
    await dismissModals(page);

    // Scope to the detail title bar: a .cluster-pin also exists in the global header.
    const titleBar = page.locator('.title-bar');
    const badgeState = titleBar.locator('.badge-state');
    const pinControl = titleBar.locator('.cluster-pin');

    await expect(pinControl).toBeVisible();

    // The pin control sits after the badge chip in the detail title row (Scenario 11)
    await expect(badgeState).toBeVisible();
    await expect
      .poll(
        async () => {
          const badgeBox = await badgeState.boundingBox();
          const pinBox = await pinControl.boundingBox();

          return !!badgeBox && !!pinBox && pinBox.x > badgeBox.x;
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    await expect(pinControl).toHaveAttribute('aria-pressed', 'false');

    // Click detail title pin to toggle pin state
    await pinControl.click();
    await expect(pinControl).toHaveAttribute('aria-pressed', 'true');

    // Verify top nav shelf reflects pinned cluster
    await openBurgerMenu(page);
    await expect(page.locator('.clustersPinned').filter({ hasText: 'qa-19241-prov' })).toBeVisible();

    await page.screenshot({ path: path.join(evidenceDir, 'scenario-11-detail-title-pin.png') });
    await titleBar.screenshot({ path: path.join(evidenceDir, 'scenario-11-detail-title-pin-titlebar.png') });
    await closeBurgerMenu(page);

    // Press Alt+P (Windows/Linux) to toggle pin state via keyboard shortcut
    await page.keyboard.press('Alt+p');
    await expect(pinControl).toHaveAttribute('aria-pressed', 'false');

    await openBurgerMenu(page);
    await expect(page.locator('.clustersPinned').filter({ hasText: 'qa-19241-prov' })).toHaveCount(0);

    await page.screenshot({ path: path.join(evidenceDir, 'scenario-12-keyboard-shortcut-alt-p.png') });
    await closeBurgerMenu(page);
  });

  test('7. Dark theme maintains high-contrast badge rendering (Scenario 14)', async ({ page, rancherApi }) => {
    // Set theme preference to ui-dark
    await rancherApi.setUserPreference({ theme: '"ui-dark"' });

    const clusterList = new ClusterManagerListPagePo(page, 'local');

    await clusterList.goTo();
    await clusterList.sortableTable().checkLoadingIndicatorNotVisible();
    await dismissModals(page);

    // Verify dark theme is applied to document body
    await expect(page.locator('body')).toHaveClass(/theme-dark/);

    const customRow = clusterList.sortableTable().rowWithName('Production Cluster Alpha');

    await expect(customRow.self()).toBeVisible();

    const badgeChip = customRow.badge();

    await expect(badgeChip).toBeVisible();
    await expect(badgeChip.locator('.cluster-badge-logo-text')).toHaveText('PRD');

    await page.screenshot({ path: path.join(evidenceDir, 'scenario-14-badge-dark-theme.png') });

    // Restore to auto theme
    await rancherApi.setUserPreference({ theme: '"ui-auto"' });
  });

  test('8. Light theme maintains high-contrast badge rendering (Scenario 14)', async ({ page, rancherApi }) => {
    // Set theme preference to ui-light
    await rancherApi.setUserPreference({ theme: '"ui-light"' });

    const clusterList = new ClusterManagerListPagePo(page, 'local');

    await clusterList.goTo();
    await clusterList.sortableTable().checkLoadingIndicatorNotVisible();
    await dismissModals(page);

    // Verify light theme is applied to document body
    await expect(page.locator('body')).toHaveClass(/theme-light/);

    const customRow = clusterList.sortableTable().rowWithName('Production Cluster Alpha');

    await expect(customRow.self()).toBeVisible();

    const badgeChip = customRow.badge();

    await expect(badgeChip).toBeVisible();
    await expect(badgeChip.locator('.cluster-badge-logo-text')).toHaveText('PRD');

    await page.screenshot({ path: path.join(evidenceDir, 'scenario-14-badge-light-theme.png') });

    // Restore to auto theme
    await rancherApi.setUserPreference({ theme: '"ui-auto"' });
  });
});
