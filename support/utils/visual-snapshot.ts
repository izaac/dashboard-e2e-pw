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
export const ensureLightTheme = async (rancherApi: RancherApi): Promise<() => Promise<void>> => {
  const prefsResp = await rancherApi.getRancherResource('v1', 'userpreferences');
  const previousTheme: string = prefsResp.body?.data?.[0]?.data?.theme ?? '';

  await rancherApi.setUserPreference({ theme: 'ui-light' });

  return async () => {
    await rancherApi.setUserPreference({ theme: previousTheme });
  };
};
