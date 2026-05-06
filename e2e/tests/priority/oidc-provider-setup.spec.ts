import type { Page } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';
import { FeatureFlagsPagePo } from '@/e2e/po/pages/global-settings/feature-flags.po';
import { recoverFromRancherRestart } from '@/support/utils/feature-flag';
import { PROVISIONING } from '@/support/timeouts';

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

  // Wait for Rancher to bounce + come back, reload the SPA, re-login.
  await recoverFromRancherRestart(page, rancherApi, login);
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
