import type { Page } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';
import { FeatureFlagsPagePo } from '@/e2e/po/pages/global-settings/feature-flags.po';
import { BRIEF, EXTENSION_OPS, LONG, PROVISIONING } from '@/support/timeouts';

/**
 * OIDC Provider Setup Test
 *
 * Toggling the `oidc-provider` feature flag causes Rancher to self-restart.
 * It is bidirectional — `oidc-provider` is not in `ONE_WAY` (only
 * `token-hashing` and `multi-cluster-management` are) so the flag can be
 * activated and deactivated.
 *
 * `ensureFeatureFlagState` is the resilience harness:
 *   - reads current state and no-ops if it already matches the target,
 *   - clicks the right action (`Activate` or `Deactivate`),
 *   - waits for Rancher to actually go down before polling for healthy,
 *   - waits for Rancher to come back,
 *   - reloads + re-logs in (local auth always works as a fallback) and
 *     verifies the new state.
 */

type FeatureFlagState = 'Active' | 'Disabled';

const TARGET_STATE: FeatureFlagState = 'Active';

async function ensureFeatureFlagState(
  page: Page,
  featureFlagsPage: FeatureFlagsPagePo,
  rancherApi: import('@/support/fixtures/rancher-api').RancherApi,
  login: () => Promise<void>,
  ffId: string,
  target: FeatureFlagState,
): Promise<void> {
  const current = (await featureFlagsPage.list().details(ffId, 0).innerText()).trim();

  if (current.includes(target)) {
    return;
  }

  const action = target === 'Active' ? 'Activate' : 'Deactivate';

  await featureFlagsPage.list().clickRowActionMenuItem(ffId, action);

  // Click confirm in the prompt-update modal. waitForModal is false — the modal
  // will not auto-detach because the connection drops as Rancher restarts.
  // We don't assert the PUT body here (Rancher restarts mid-response) — just
  // wait for the request to fire so the restart cycle starts.
  await featureFlagsPage.clickCardActionButtonAndWait(action, ffId, {
    waitForModal: false,
    waitForRequest: true,
  });

  // Step 1: wait for Rancher to actually go down. Without this, waitForHealthy
  // would pass against the still-up pre-restart Rancher and race the restart.
  await expect
    .poll(
      async () => {
        const resp = await rancherApi.getRancherResource('v1', 'counts', undefined, 0).catch(() => ({ status: 0 }));

        return resp.status;
      },
      { timeout: LONG, intervals: [BRIEF] },
    )
    .not.toBe(200);

  // Step 2: wait for Rancher to come back. Embedded k3s typically restarts in 30–90 s;
  // give it up to EXTENSION_OPS (3 min) of BRIEF-spaced probes to be safe.
  await rancherApi.waitForHealthy(EXTENSION_OPS / BRIEF, BRIEF);

  // Step 3: reload the SPA so it reconnects to the restarted Rancher, then verify.
  await page.reload();
  await login();
  await featureFlagsPage.navTo();
  await featureFlagsPage.waitForPage();

  await expect(featureFlagsPage.list().details(ffId, 0)).toContainText(target);
}

test.describe('Enable OIDC Provider', { tag: ['@jenkins', '@noPrime', '@adminUser'] }, () => {
  // The toggle path waits for Rancher to go down (~30 s of polling) and come back
  // (waitForHealthy 36 × 5 s), then reloads + re-logs in. PROVISIONING (5 min)
  // accommodates a worst-case restart cycle plus assertions.
  test.setTimeout(PROVISIONING);

  test('Enable Feature Flag', async ({ page, login, rancherApi }) => {
    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();

    const featureFlagsPage = new FeatureFlagsPagePo(page, 'local');

    await featureFlagsPage.navTo();
    await featureFlagsPage.waitForPage();

    await ensureFeatureFlagState(page, featureFlagsPage, rancherApi, login, 'oidc-provider', TARGET_STATE);

    // Final assertion regardless of which path was taken.
    await expect(featureFlagsPage.list().details('oidc-provider', 0)).toContainText(TARGET_STATE);
  });
});
