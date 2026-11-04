import fs from 'fs';
import path from 'path';
import { errors, type Page } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import { WorkloadsPodsListPagePo } from '@/e2e/po/pages/explorer/workloads-pods.po';
import { HeaderPo } from '@/e2e/po/components/header.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';

const EVIDENCE_DIR =
  process.env.QA_EVIDENCE_DIR || '/home/izaac/Documents/ui-qa-plans/plans/qa-19551-table-view-shortcuts-browser-conflict-evidence';

type RecordedKeyDown = { key: string; defaultPrevented: boolean } | null;

/**
 * Records the last Ctrl/Cmd+S or +D keydown and whether the page had already called preventDefault on it.
 * The app's shortcut plugin listens on document in the capture phase and stops propagation when it claims a key,
 * so this listens on the same node and phase, registered later, which still runs after the app's listener.
 */
async function recordKeyDowns(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).__lastKeyDown = null;
    document.addEventListener('keydown', (e) => {
      if (['s', 'S', 'd', 'D'].includes(e.key) && (e.ctrlKey || e.metaKey)) {
        (window as any).__lastKeyDown = {
          key:              e.key,
          defaultPrevented: e.defaultPrevented
        };
      }
    }, true);
  });
}

/** The Prime welcome dialog mounts a moment after the list renders, and only on Prime builds */
async function dismissWelcomeDialog(page: Page): Promise<void> {
  const welcome = new WelcomeDialogPo(page);

  try {
    await welcome.self().waitFor({ state: 'visible', timeout: 10000 });
  } catch (e) {
    if (!(e instanceof errors.TimeoutError)) {
      throw e;
    }

    return;
  }

  await welcome.dismissIfVisible();
}

test.describe('Table View Shortcuts Conflict With Browser (#19551)', { tag: ['@generic', '@adminUser'] }, () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  let originalTableViews: string | undefined;

  test.beforeEach(async ({ login, page, rancherApi }) => {
    // Saved views live in the user's preferences: start from none, and restore what was there afterwards
    const prefs = await rancherApi.getRancherResource('v1', 'userpreferences');

    originalTableViews = prefs.body.data[0]?.data?.['table-views'];
    await rancherApi.setUserPreference({ 'table-views': '{}' });

    await login();

    const podsList = new WorkloadsPodsListPagePo(page);

    await podsList.goTo();
    await dismissWelcomeDialog(page);
    await expect(page.getByTestId('table-views-tabs')).toBeVisible();
    await expect(podsList.sortableTable().self()).toBeVisible();
  });

  test.afterEach(async ({ rancherApi }) => {
    await rancherApi.setUserPreference({ 'table-views': originalTableViews ?? '{}' });
  });

  test('focus outside the table leaves Ctrl+S and Ctrl+D to the browser', async ({ page }) => {
    await recordKeyDowns(page);

    // Move focus outside the table: click an inert corner of the top header
    await new HeaderPo(page).self().click({ position: { x: 2, y: 2 } });
    await expect(page.getByTestId('table-views-query')).not.toBeFocused();

    await page.keyboard.press('Control+s');
    const sEvent: RecordedKeyDown = await page.evaluate(() => (window as any).__lastKeyDown);

    expect(sEvent?.key.toLowerCase()).toBe('s');
    expect(sEvent?.defaultPrevented).toBe(false);
    await expect(page.getByTestId('table-views-save-modal')).toBeHidden();

    await page.keyboard.press('Control+d');
    const dEvent: RecordedKeyDown = await page.evaluate(() => (window as any).__lastKeyDown);

    expect(dEvent?.key.toLowerCase()).toBe('d');
    expect(dEvent?.defaultPrevented).toBe(false);
    await expect(page.getByTestId('table-views-save-modal')).toBeHidden();

    // Ctrl+D must not have duplicated the view either: only the table's own tab exists
    await expect(page.getByTestId('table-views-tabs').getByRole('tab')).toHaveCount(1);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-01-focus-outside-table-browser-save.png') });
  });

  test('focus inside the table claims Ctrl+Shift+S and saves the view as new', async ({ page }) => {
    await recordKeyDowns(page);

    // Focus inside the table and leave an unsaved change, which Save as New needs
    const queryBox = page.getByTestId('table-views-query');

    await queryBox.focus();
    await queryBox.fill('kube');
    await expect(page.getByTestId('table-views-unsaved')).toBeVisible();
    await expect(queryBox).toBeFocused();

    await page.keyboard.press('Control+Shift+S');

    const keyEvent: RecordedKeyDown = await page.evaluate(() => (window as any).__lastKeyDown);

    expect(keyEvent?.defaultPrevented).toBe(true);

    // The shortcut lands the changes as a new view tab with its name open for typing
    const renameInput = page.getByRole('textbox', { name: 'Rename View' });

    await expect(renameInput).toBeVisible();
    // The table's own tab stays; the new view's tab is the name field until it is committed
    await expect(page.getByTestId('table-views-tabs').getByRole('tab')).toHaveCount(1);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-03-focus-inside-table-save-view-modal.png') });

    await page.keyboard.press('Escape');
  });
});
