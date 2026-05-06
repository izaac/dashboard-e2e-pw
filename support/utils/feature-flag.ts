import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import { BRIEF, EXTENSION_OPS, LONG } from '@/support/timeouts';

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
 * Wait for the Rancher controller to actually restart and become healthy
 * again. Two-phase: first confirm /v1/counts is unreachable (the restart
 * really started), then wait for 3 consecutive healthy probes.
 */
export async function waitForRancherRestartCycle(rancherApi: RancherApi): Promise<void> {
  await expect
    .poll(
      async () => {
        const resp = await rancherApi
          .getRancherResource('v1', 'counts', undefined, 0)
          .catch(() => ({ status: 0 }) as { status: number });

        return resp.status;
      },
      { timeout: LONG, intervals: [BRIEF] },
    )
    .not.toBe(200);

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
