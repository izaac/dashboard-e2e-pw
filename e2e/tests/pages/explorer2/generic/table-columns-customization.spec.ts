import fs from 'fs';
import path from 'path';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import { ConfigMapsPagePo } from '@/e2e/po/pages/explorer/configmaps.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';

const EVIDENCE_DIR =
  process.env.QA_EVIDENCE_DIR || '/home/izaac/Documents/ui-qa-plans/plans/qa-15222-rearrange-and-hide-table-columns-evidence';

/** The visible column labels of the table, in order: the checkbox and actions headers have no text */
async function headerLabels(table: Locator): Promise<string[]> {
  // eslint-disable-next-line playwright/no-raw-locators -- header cells are read by position and text; the role query does not resolve inside the sortable table
  const ths = table.locator('thead th');
  const count = await ths.count();
  const labels: string[] = [];

  for (let i = 0; i < count; i++) {
    const text = (await ths.nth(i).innerText()).trim();

    if (text) {
      labels.push(text.split('\n')[0].trim());
    }
  }

  return labels;
}

/** The "View" dropdown: its menu lists group by, columns configuration and reset */
async function openViewMenu(page: Page): Promise<void> {
  await page.getByTestId('table-views-view-menu').click();
  await expect(page.getByTestId('table-views-view-columns')).toBeVisible();
}

/** Opens View > Columns Configuration and waits for its column rows. Safe to call with the menu already open */
async function openColumnsSubmenu(page: Page): Promise<void> {
  const columnRows = page.getByTestId(/^table-views-col-(?!handle-)/);

  if (await columnRows.first().isVisible()) {
    return;
  }

  if (!(await page.getByTestId('table-views-view-columns').isVisible())) {
    await openViewMenu(page);
  }

  const columnsItem = page.getByTestId('table-views-view-columns');

  await columnsItem.waitFor({ state: 'visible' });
  await columnsItem.hover();

  // If the submenu does not open on hover, fall back to a click
  try {
    await columnRows.first().waitFor({ state: 'visible', timeout: 500 });
  } catch {
    await columnsItem.click();
  }

  await columnRows.first().waitFor({ state: 'visible', timeout: 5000 });
}

/** Closes the submenu and the dropdown, whichever level Escape lands on first */
async function closeMenu(page: Page): Promise<void> {
  const menuItem = page.getByTestId('table-views-view-columns');

  // Escape up to 3 times, letting the menu settle between presses
  for (let i = 0; i < 3; i++) {
    if (!(await menuItem.isVisible())) {
      break;
    }

    await page.keyboard.press('Escape');
    await menuItem.waitFor({ state: 'hidden', timeout: 500 }).catch(() => {});
  }

  // If still visible, click outside the menu (top-left corner of the viewport)
  if (await menuItem.isVisible()) {
    await page.mouse.click(1, 1);
  }

  await expect(menuItem).toBeHidden({ timeout: 5000 });
}

test.describe('Table Columns Customization (#15222)', { tag: ['@generic', '@adminUser'] }, () => {
  let originalTableViews: string | undefined;
  let table: Locator;
  let initialHeaders: string[];

  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test.beforeEach(async ({ login, page, rancherApi }) => {
    // Column visibility and order live in the user's saved table views: start from none, and restore afterwards
    const prefs = await rancherApi.getRancherResource('v1', 'userpreferences');

    originalTableViews = prefs.body.data[0]?.data?.['table-views'];
    await rancherApi.setUserPreference({ 'table-views': JSON.stringify({}) });

    await login();

    const configMaps = new ConfigMapsPagePo(page);

    await configMaps.goTo();
    await configMaps.waitForPage();
    await new WelcomeDialogPo(page).dismissIfVisible();

    table = configMaps.list().resourceTable().sortableTable().self();
    await expect(page.getByTestId('table-views-tabs')).toBeVisible();
    await expect(table).toBeVisible();
    // eslint-disable-next-line playwright/no-raw-locators -- header cells are read by position and text; the role query does not resolve inside the sortable table
    await expect(table.locator('thead th').filter({ hasText: 'Name' }).first()).toBeVisible();

    initialHeaders = await headerLabels(table);
  });

  test.afterEach(async ({ rancherApi }) => {
    await rancherApi.setUserPreference({ 'table-views': originalTableViews ?? JSON.stringify({}) });
  });

  test('hiding an optional column removes its header from the table', async ({ page }) => {
    expect(initialHeaders).toContain('Data');

    await openColumnsSubmenu(page);

    const dataRow = page.getByTestId('table-views-col-keys');

    await expect(dataRow).toBeVisible();
    await dataRow.click();
    await closeMenu(page);

    await expect.poll(() => headerLabels(table)).not.toContain('Data');
    // The other columns are untouched
    await expect.poll(() => headerLabels(table)).toEqual(initialHeaders.filter((h) => h !== 'Data'));

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-01-hide-column-removed-from-table.png') });
  });

  test('essential core columns remain locked and cannot be hidden', async ({ page }) => {
    expect(initialHeaders).toContain('Name');

    await openColumnsSubmenu(page);

    const nameRow = page.getByTestId('table-views-col-name');

    await expect(nameRow).toBeVisible();
    await expect(nameRow).toHaveClass(/locked/);
    // Core columns get a lock icon instead of the reorder grip
    await expect(page.getByTestId('table-views-col-handle-name')).toHaveCount(0);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-02-locked-core-columns.png') });

    // A disabled row refuses a real click, so dispatch the event to prove the handler ignores it too
    await nameRow.dispatchEvent('click');
    await expect(nameRow).toHaveClass(/shown/);

    await closeMenu(page);

    await expect.poll(() => headerLabels(table)).toContain('Name');
    await expect.poll(() => headerLabels(table)).toEqual(initialHeaders);
  });

  test('reordering columns with Alt+ArrowDown shifts the column position', async ({ page }) => {
    // Namespace sits right after the locked Name column: moving it down swaps it with the next optional column
    const movedLabel = 'Namespace';
    const fromIndex = initialHeaders.indexOf(movedLabel);

    expect(fromIndex).toBeGreaterThan(-1);
    expect(fromIndex).toBeLessThan(initialHeaders.length - 1);

    await openColumnsSubmenu(page);

    const colItem = page.getByTestId('table-views-col-namespace');

    await colItem.focus();
    await expect(colItem).toBeFocused();
    await page.keyboard.press('Alt+ArrowDown');

    const expected = [...initialHeaders];

    expected.splice(fromIndex + 1, 0, expected.splice(fromIndex, 1)[0]);

    await closeMenu(page);

    await expect.poll(() => headerLabels(table)).toEqual(expected);
    expect(expected).not.toEqual(initialHeaders);
    expect(expected.indexOf(movedLabel)).toBe(fromIndex + 1);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-03-keyboard-reorder-column-position.png') });
  });

  test('Select All Columns restores all hidden optional columns', async ({ page }) => {
    // Start with an optional column hidden, so there is something to restore
    await openColumnsSubmenu(page);
    await page.getByTestId('table-views-col-keys').click();
    await expect.poll(() => headerLabels(table)).not.toContain('Data');

    await openColumnsSubmenu(page);
    await page.getByTestId('table-views-columns-select-all').click();
    await closeMenu(page);

    await expect.poll(() => headerLabels(table)).toContain('Data');
    for (const label of initialHeaders) {
      await expect.poll(() => headerLabels(table)).toContain(label);
    }

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-05-select-all-columns-restored.png') });
  });

  test('Reset Columns to Default restores the original schema order and visibility', async ({ page }) => {
    // Customise both visibility and order first: reset is disabled while the columns are as they came
    await openColumnsSubmenu(page);
    await page.getByTestId('table-views-col-keys').click();
    await expect.poll(() => headerLabels(table)).not.toContain('Data');

    await openColumnsSubmenu(page);
    await page.getByTestId('table-views-col-namespace').focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect.poll(() => headerLabels(table)).not.toEqual(initialHeaders);

    await openColumnsSubmenu(page);

    const reset = page.getByTestId('table-views-columns-reset');

    await expect(reset).toBeEnabled();
    await reset.click();
    await closeMenu(page);

    await expect.poll(() => headerLabels(table)).toEqual(initialHeaders);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-06-reset-columns-to-default.png') });
  });
});
