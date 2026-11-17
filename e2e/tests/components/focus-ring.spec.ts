import { test, expect } from '@/support/fixtures';
import type { Locator, Page } from '@playwright/test';
import FocusRingPo from '@/e2e/po/components/focus-ring.po';
import { NamespaceFilterPo } from '@/e2e/po/components/namespace-filter.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import { WorkloadsPodsListPagePo } from '@/e2e/po/pages/explorer/workloads-pods.po';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';
import UserMenuPo from '@/e2e/po/side-bars/user-menu.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';

/**
 * #19472: the focus ring was painted on `:focus`, so a mouse click left a ring behind. It
 * now follows `:focus-visible`, and the open side nav group reads the secondary menu token.
 * Fixed by dashboard 116fe5548e (PR #19475).
 */
const POD_IMAGE = 'nginx:alpine';
const SHELL_ITEM = 'Execute Shell';
const RING_TOKEN = '--primary-keyboard-focus';
const RING_SIZE = '2px solid';

/** Tokens the open nav group, the closed ones, the selected type and its hover read from */
const NAV_TOKENS = {
  group: '--rc-section-background-secondary',
  closed: '--nav-bg',
  active: '--active',
  activeText: '--on-active',
  activeHover: '--active-hover',
};

type Reached = {
  locator: Locator;
  /** How many Tab presses keyboard traversal took, which is what proves it is a tab stop */
  presses: number;
  /** Keys past the Tab walk that carry focus the rest of the way, when the target is not a tab stop */
  via?: string;
};

type FocusTarget = {
  name: string;
  /** Puts the element on screen and returns it, so a menu item comes back from a fresh menu */
  reveal: () => Promise<Locator>;
  /** Brings focus to it with keystrokes only */
  reach: () => Promise<Reached>;
  /** Whether a pointer press may focus it: components with `@mousedown.prevent` refuse to */
  focusOnPress: boolean;
  /** Puts the page back the way it was found */
  restore: () => Promise<void>;
  /** The element leaves the DOM the moment a click completes, so its press is cancelled */
  transient?: boolean;
};

/** The ring's own paint, or 'none' when nothing is drawn */
async function ringOf(focus: FocusRingPo, target: Locator): Promise<string> {
  const { style, width, color } = await focus.outlineOf(target);

  return style === 'none' || Number.parseFloat(width) === 0 ? 'none' : `${width} ${style} ${color}`;
}

function escapeOverlay(page: Page): () => Promise<void> {
  return () => page.keyboard.press('Escape');
}

/** Opens the pod list and narrows it to the test's own pod */
async function openPodRow(page: Page, podName: string): Promise<SortableTablePo> {
  const pods = new WorkloadsPodsListPagePo(page);

  await pods.goTo();
  await new WelcomeDialogPo(page).dismissIfVisible();

  const table = pods.sortableTable();
  const views = pods.tableViews();

  await table.checkLoadingIndicatorNotVisible();
  await views.typeQuery(podName);
  await views.blurQuery();
  await expect(table.rowElements()).toHaveCount(1);

  return table;
}

/** Returns the locator once it is on screen */
function showVisible(locator: Locator): () => Promise<Locator> {
  return async () => {
    await expect(locator).toBeVisible();

    return locator;
  };
}

/** Tabs to the target, from wherever focus is, and reports how many presses it cost */
function tabTo(focus: FocusRingPo, get: () => Locator): () => Promise<Reached> {
  return async () => {
    const locator = get();

    await expect(locator).toBeVisible();

    return { locator, presses: await focus.focusWithKeyboard(locator) };
  };
}

test.describe('Focus ring on keyboard focus only', { tag: ['@components', '@adminUser'] }, () => {
  const podName = `focus-ring-pod-${Date.now()}`;

  let namespace: string;

  test.beforeAll(async ({ rancherApi }) => {
    namespace = rancherApi.createE2EResourceName('focus-ring');

    await rancherApi.createNamespace(namespace);
    await rancherApi.createPod(namespace, podName, POD_IMAGE);

    // The Execute Shell action is only offered once the pod's container is up
    const running = await rancherApi.waitForRancherResource(
      'v1',
      'pods',
      '',
      (resp) => {
        const pod = resp.body?.data?.find((p: { id: string }) => p.id === `${namespace}/${podName}`);

        return pod?.status?.phase === 'Running' && pod?.status?.containerStatuses?.[0]?.ready === true;
      },
      30,
      2000,
    );

    expect(running).toBe(true);
  });

  test.afterAll(async ({ rancherApi }) => {
    // Nothing else uses this namespace, so no wait on the finaliser
    await rancherApi.deleteRancherResource('v1', 'namespaces', namespace, false);
  });

  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('every ring target paints on keyboard focus, not on the mouse', async ({ page }) => {
    const focus = new FocusRingPo(page);
    const table = await openPodRow(page, podName);
    const userMenu = new UserMenuPo(page);
    const nsFilter = new NamespaceFilterPo(page);
    const escape = escapeOverlay(page);
    const ring = `${RING_SIZE} ${await focus.tokenColor(RING_TOKEN)}`;
    const actionButton = table.rowWithName(podName).actionBtn();
    const rowCheckbox = table.rowSelectCtlWithName(podName).checkboxCustom();

    // Opens the row menu with the mouse and hands back the container shell item in it
    const shellItem = async () => {
      const menu = await table.rowActionMenuOpen(podName);

      return menu.getMenuItem(SHELL_ITEM);
    };

    const closeNsFilter = async () => {
      if (await nsFilter.getOptions().isVisible()) {
        await nsFilter.toggle();
      }
    };

    const targets: FocusTarget[] = [
      {
        name: 'ghost header button',
        reveal: showVisible(userMenu.self()),
        reach: tabTo(focus, () => userMenu.self()),
        focusOnPress: true,
        restore: escape,
      },
      {
        name: 'row action link button',
        reveal: showVisible(actionButton),
        reach: tabTo(focus, () => actionButton),
        focusOnPress: true,
        restore: escape,
      },
      {
        name: 'bulk select checkbox',
        reveal: showVisible(rowCheckbox),
        reach: tabTo(focus, () => rowCheckbox),
        focusOnPress: true,
        restore: () => table.rowSelectCtlWithName(podName).uncheck(),
      },
      {
        name: 'namespace filter trigger',
        reveal: showVisible(nsFilter.self()),
        reach: tabTo(focus, () => nsFilter.self()),
        // The trigger carries `@mousedown.prevent`, so a pointer is not allowed to focus it and
        // only the keyboard can; opening it moves focus to its own search field
        focusOnPress: false,
        restore: closeNsFilter,
      },
      {
        name: 'container shell trigger',
        reveal: shellItem,
        // A menu item is `tabindex="-1"`, so Tab can never land on it. A keyboard user gets there
        // the way the component means it: Tab to the row action button, Enter to open the menu, and
        // the menu hands focus to its first item, which for a pod is Execute Shell.
        reach: async () => {
          const presses = await focus.focusWithKeyboard(actionButton);

          await page.keyboard.press('Enter');

          const item = table.rowActionMenu().getMenuItem(SHELL_ITEM);

          await expect(item).toBeVisible();
          await expect(item).toBeFocused();

          return { locator: item, presses, via: 'Enter' };
        },
        // The item carries `@mousedown.prevent` too: its ring is keyboard-only by design
        focusOnPress: false,
        restore: escape,
        transient: true,
      },
    ];

    for (const target of targets) {
      const pressed = await target.reveal();

      await focus.mouseDownOn(pressed);

      // A ring on an unfocused element would mean nothing, so the focus the pointer did or did
      // not take is asserted first, then that it came in without one
      await expect.poll(() => focus.isFocused(pressed), { message: target.name }).toBe(target.focusOnPress);
      await expect.poll(() => ringOf(focus, pressed), { message: target.name }).toBe('none');
      await expect.poll(() => focus.focusVisibleOf(pressed), { message: target.name }).toBe(false);

      if (target.transient) {
        await focus.releaseMouseAway();
      } else {
        await focus.releaseMouse();
      }

      await target.restore();

      const typed = await target.reach();

      // The same element on the same page paints the ring, so the check above was not vacuous
      await expect.poll(() => ringOf(focus, typed.locator), { message: target.name }).toBe(ring);
      await expect.poll(() => focus.focusVisibleOf(typed.locator), { message: target.name }).toBe(true);
      console.warn(`[focus-ring] ${target.name}: ${typed.presses} Tab press(es)${typed.via ? ` + ${typed.via}` : ''}`);

      await target.restore();
    }
  });

  test('Escape returns focus to the row action button, ring and all', async ({ page }) => {
    const focus = new FocusRingPo(page);
    const table = await openPodRow(page, podName);
    const menu = table.rowActionMenu();
    const button = table.rowWithName(podName).actionBtn();
    const ring = `${RING_SIZE} ${await focus.tokenColor(RING_TOKEN)}`;

    try {
      const presses = await focus.focusWithKeyboard(button);

      console.warn(`[focus-ring] row action button before Enter: ${presses} Tab press(es)`);
      await page.keyboard.press('Enter');
      await expect(menu.self()).toBeVisible();

      await page.keyboard.press('Escape');

      await expect(menu.self()).toBeHidden();
      // The ring has to survive the round trip through the menu, so the user can keep going
      await expect(button).toBeFocused();
      await expect.poll(() => ringOf(focus, button)).toBe(ring);
    } finally {
      await escapeOverlay(page)();
    }
  });

  test('row action button holds one background through hover, press and release', async ({ page }) => {
    const focus = new FocusRingPo(page);
    const table = await openPodRow(page, podName);
    const button = table.rowWithName(podName).actionBtn();

    let hovered = 'transparent';
    let pressed = 'transparent';
    let released = 'transparent';

    try {
      await button.hover();
      hovered = await focus.computedOf(button, 'background-color');

      await focus.mouseDownOn(button);
      pressed = await focus.computedOf(button, 'background-color');

      await focus.releaseMouse();
      released = await focus.computedOf(button, 'background-color');
    } finally {
      await escapeOverlay(page)();
    }

    expect(hovered).not.toBe('transparent');
    // A press that repainted would read as a button stuck between two states
    expect(pressed).toBe(hovered);
    expect(released).toBe(hovered);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`side nav uses the secondary menu tokens (${theme})`, async ({ page, rancherApi }) => {
      const focus = new FocusRingPo(page);
      const nav = new ProductNavPo(page);
      const pods = new WorkloadsPodsListPagePo(page);

      // Theme is a user preference the app reads on load, stored quoted as JSON. Remember it so
      // the account is left as it was found
      const stored = await rancherApi.getRancherResource('v1', 'userpreferences');
      const originalTheme = stored.body.data[0]?.data?.theme ?? '"ui-auto"';

      try {
        // Whatever theme the session loaded with, before anything is forced
        const navBgBefore = await focus.tokenColor(NAV_TOKENS.closed);

        await rancherApi.setUserPreference({ theme: `"ui-${theme}"` });
        await pods.goTo();
        await new WelcomeDialogPo(page).dismissIfVisible();

        await expect(pods.body()).toHaveClass(new RegExp(`theme-${theme}`));

        // A theme the app refused would compare light paint against light tokens and pass by
        // accident, so dark has to move --nav-bg off the session's starting value and light,
        // which is that value, must not move it
        const navBg = await focus.tokenColor(NAV_TOKENS.closed);

        expect(navBg !== navBgBefore, `the ${theme} theme did not change ${NAV_TOKENS.closed}`).toBe(theme === 'dark');

        const group = nav.selectedGroup();
        const link = nav.selectedTypeLink();
        const closedCount = await nav.collapsedGroups().count();

        await expect(group).toBeVisible();
        await expect(link).toBeVisible();
        expect(closedCount).toBeGreaterThan(0);

        // A token that is not declared would compare equal to its own fallback by accident
        expect(await focus.navToken(NAV_TOKENS.group)).not.toBe('');

        await expect.poll(() => focus.paintedBackgroundOf(group)).toBe(await focus.tokenColor(NAV_TOKENS.group));
        await expect
          .poll(() => focus.computedOf(link, 'background-color'))
          .toBe(await focus.tokenColor(NAV_TOKENS.active));
        await expect.poll(() => focus.computedOf(link, 'color')).toBe(await focus.tokenColor(NAV_TOKENS.activeText));

        for (let index = 0; index < closedCount; index += 1) {
          const closed = nav.collapsedGroups().nth(index);

          await expect.poll(() => focus.paintedBackgroundOf(closed)).toBe(await focus.tokenColor(NAV_TOKENS.closed));
        }

        await link.hover();
        await expect
          .poll(() => focus.computedOf(link, 'background-color'))
          .toBe(await focus.tokenColor(NAV_TOKENS.activeHover));
      } finally {
        // A theme left behind would change what the next test sees
        await rancherApi.setUserPreference({ theme: originalTheme });
        await escapeOverlay(page)();
      }
    });
  }
});
