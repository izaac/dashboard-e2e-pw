import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import { BRIEF, EXTENSION_OPS } from '@/support/timeouts';

/**
 * Feature flags whose toggle causes Rancher to self-restart. Code that toggles
 * one of these MUST follow the call with `waitForRancherRestartCycle` before
 * making any further API/UI assertions, or the next call will race the
 * still-up pre-restart Rancher.
 */
export const DANGEROUS_FLAGS = ['oidc-provider', 'harvester', 'istio-virtual-service-ui'] as const;
export type DangerousFlag = (typeof DANGEROUS_FLAGS)[number];

export function isDangerousFlag(name: string): name is DangerousFlag {
  return (DANGEROUS_FLAGS as readonly string[]).includes(name);
}

/**
 * Wait for the Rancher controller to restart and become healthy again.
 *
 * Phase 1 observes /v1/counts going non-200 (the restart actually started).
 * Real restarts are visible within a few seconds of the trigger PUT — if no
 * blip is seen inside the short observation window, we assume the toggle was
 * a no-op (e.g. setting `spec.value` to a value equivalent to the resolved
 * default) and return without waiting. Optimistic by design: we cannot
 * reliably predict whether a given PUT will fire a restart from the request
 * alone (the resource doesn't expose the resolved default), so we observe
 * the side effect instead.
 *
 * Phase 2 (only when a restart was observed) waits for 3 consecutive healthy
 * probes via `waitForHealthy`.
 */
export async function waitForRancherRestartCycle(rancherApi: RancherApi): Promise<void> {
  const observationWindow = BRIEF * 2; // ~10 s — restarts surface fast; no-ops shouldn't.
  let observedDown = false;

  try {
    await expect
      .poll(
        async () => {
          const resp = await rancherApi
            .getRancherResource('v1', 'counts', undefined, 0)
            .catch(() => ({ status: 0 }) as { status: number });

          return resp.status;
        },
        { timeout: observationWindow, intervals: [BRIEF / 5] },
      )
      .not.toBe(200);
    observedDown = true;
  } catch {
    // No downtime observed within the window — toggle was a no-op.
  }

  if (!observedDown) {
    return;
  }

  await rancherApi.waitForHealthy(EXTENSION_OPS / BRIEF, BRIEF);
}

/**
 * Wait for the restart, reload the SPA so it reconnects, then re-login —
 * the active session may have been invalidated when the controller bounced.
 */
export async function recoverFromRancherRestart(
  page: Page,
  rancherApi: RancherApi,
  login: () => Promise<void>,
): Promise<void> {
  await waitForRancherRestartCycle(rancherApi);
  await page.reload();
  await login();
}
