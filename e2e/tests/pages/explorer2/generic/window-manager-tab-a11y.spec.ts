import { test, expect } from '@/support/fixtures';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';
import { HeaderPo } from '@/e2e/po/components/header.po';
import WindowManagerPo from '@/e2e/po/components/window-manager.po';

test.describe('Window manager tab structure a11y smoke', { tag: ['@generic', '@adminUser'] }, () => {
  test.beforeEach(async ({ page, login }) => {
    await login();

    const dashboard = new ClusterDashboardPagePo(page, 'local');

    await dashboard.goTo();
    await dashboard.waitForPage();
    await new WelcomeDialogPo(page).dismissIfVisible();

    const header = new HeaderPo(page);
    const wm = new WindowManagerPo(page);

    // Opens the kubectl shell only to get a window manager tab on screen; no data is created
    try {
      await header.kubectlShell().openTerminal();
    } catch {
      test.skip(true, 'Kubectl shell could not be opened, window manager tabs are not available');
    }

    await expect(wm.tabs().first()).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    const wm = new WindowManagerPo(page);

    // Leave the dock clean for idempotency
    while (await wm.closeButtons().count()) {
      await wm.closeButtons().first().click();
    }
  });

  test('tab lists only contain tabs and own existing tab ids', async ({ page }) => {
    const wm = new WindowManagerPo(page);

    // The tablist is an empty wrapper that only aria-owns the tabs, so it has no box and is never "visible"
    await expect(wm.tabLists().first()).toBeAttached();
    await expect(wm.nonTabButtonsInTabLists()).toHaveCount(0);

    const ownership = await wm.tabListOwnership();

    expect(ownership.length).toBeGreaterThan(0);
    for (const { owned, missing } of ownership) {
      expect(owned.length, 'tablist aria-owns lists at least one id').toBeGreaterThan(0);
      expect(missing, 'aria-owns ids without a matching role=tab element').toEqual([]);
    }
  });

  test('tabs have no nested interactive controls and close buttons are siblings', async ({ page }) => {
    const wm = new WindowManagerPo(page);

    await expect(wm.interactiveInsideTabs()).toHaveCount(0);
    await expect(wm.closeButtons().first()).toBeVisible();
    await expect(wm.closeButtonsInsideTabs()).toHaveCount(0);
  });
});
