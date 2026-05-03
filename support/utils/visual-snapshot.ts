import type { Locator, Page } from '@playwright/test';
import type { RancherApi } from '@/support/fixtures/rancher-api';

/**
 * Build a mode-keyed snapshot path so Prime and Community baselines never
 * clash. Prime ships a SUSE-themed brand palette (different button, banner
 * and accent colors) — a single baseline cannot match both modes.
 *
 * Returns a path-segment array that Playwright joins under the configured
 * snapshotPathTemplate, producing files under either `prime/` or
 * `community/` next to each spec.
 *
 *   const name = visualSnapshot(isPrime, 'repositories-list.png');
 *   await expect(page).toHaveScreenshot(name);
 *   // → snapshots/.../<spec>/(prime|community)/repositories-list.png
 */
export const visualSnapshot = (isPrime: boolean, name: string): string[] => [isPrime ? 'prime' : 'community', name];

/**
 * Force the admin user to light theme before a visual snapshot, returning
 * a restore function to call (typically in a `finally`) so the test does
 * not leak `ui-light` into whatever theme the user had before. The
 * preferences.spec.ts "Can select a theme" test cycles Light → Dark → Auto
 * without reverting, so subsequent specs may inherit `ui-auto` — visual
 * tests pin to light so the baseline is reproducible.
 *
 * Usage:
 *   const restoreTheme = await ensureLightTheme(rancherApi);
 *   try { ... } finally { await restoreTheme(); }
 */
/**
 * Shared masks for `toHaveScreenshot({ mask })` to hide masthead elements
 * that are user-specific or server-generated and would otherwise produce
 * pixel diffs across runs. Always include in visual snapshots that capture
 * the masthead.
 *
 *   - User avatar: derived from a hash of the principal id, so it changes
 *     when the admin user is recreated between baseline capture and run.
 *   - Notification bell: the unread-dot indicator can flip on if the
 *     server emits a transient notification during the test.
 */
export const mastheadMasks = (page: Page): Locator[] => [
  page.locator('[data-testid="nav_header_showUserMenu"]'),
  page.locator('[data-testid="notifications-center"]'),
];

export const ensureLightTheme = async (rancherApi: RancherApi): Promise<() => Promise<void>> => {
  const prefsResp = await rancherApi.getRancherResource('v1', 'userpreferences');
  const previousTheme: string = prefsResp.body?.data?.[0]?.data?.theme ?? '';

  await rancherApi.setUserPreference({ theme: 'ui-light' });

  return async () => {
    await rancherApi.setUserPreference({ theme: previousTheme });
  };
};
