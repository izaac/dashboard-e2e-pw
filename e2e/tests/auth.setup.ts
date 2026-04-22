import { test as setup, expect } from '@playwright/test';
import path from 'path';

// Unique auth file per Rancher instance — matches playwright.config.ts logic
const authPort = (() => {
  const baseUrl = process.env.TEST_BASE_URL || 'https://localhost:8005';

  try {
    return new URL(baseUrl).port || '443';
  } catch {
    return '8005';
  }
})();

export const ADMIN_AUTH_FILE = path.join(__dirname, `../../.auth/admin-${authPort}.json`);

/**
 * Pre-login health gate: verify Rancher API is responsive before attempting browser login.
 * The /v1/counts endpoint hangs when controllers are churning (e.g. after feature flag toggles).
 * Retries with backoff to ride out transient instability; fails fast with a clear message if stuck.
 */
async function waitForRancherReady(apiUrl: string, password: string, username: string): Promise<void> {
  const maxRetries = 5;
  const backoffMs = 10_000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const loginResp = await fetch(`${apiUrl}/v3-public/localProviders/local?action=login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, responseType: 'cookie' }),
        signal: AbortSignal.timeout(5_000),
      });

      if (!loginResp.ok) {
        throw new Error(`Login returned ${loginResp.status}`);
      }

      const cookie = loginResp.headers.getSetCookie?.().find((c) => c.startsWith('R_SESS='));

      if (!cookie) {
        throw new Error('No R_SESS cookie in login response');
      }

      const countsResp = await fetch(`${apiUrl}/v1/counts`, {
        headers: { Cookie: cookie.split(';')[0] },
        signal: AbortSignal.timeout(5_000),
      });

      if (!countsResp.ok) {
        throw new Error(`/v1/counts returned ${countsResp.status}`);
      }

      return;
    } catch (err) {
      if (attempt === maxRetries) {
        throw new Error(
          `Rancher API unresponsive after ${maxRetries} attempts (${(maxRetries * backoffMs) / 1000}s). ` +
            `Last error: ${err instanceof Error ? err.message : err}. ` +
            'Likely cause: controller churn from feature flag toggles or helm operations.',
        );
      }

      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
}

/**
 * Authenticate as admin and persist session cookies + localStorage.
 * All tests in the 'chromium' project reuse this state via storageState,
 * skipping the login page entirely.
 */
setup('authenticate as admin', async ({ page }) => {
  const meta = setup.info().project.metadata as Record<string, string>;
  const password = meta.password;
  const username = meta.username || 'admin';

  // Gate: ensure Rancher API is healthy before browser login attempt
  await waitForRancherReady(meta.api, password, username);

  await page.goto('./auth/login', { waitUntil: 'domcontentloaded' });

  const useLocal = page.locator('[data-testid="login-useLocal"]');

  if (await useLocal.isVisible({ timeout: 3000 }).catch(() => false)) {
    await useLocal.click();
  }

  await page
    .locator('[data-testid="local-login-username"] input, [data-testid="local-login-username"]')
    .last()
    .fill(username);
  await page.locator('[data-testid="local-login-password"] input').fill(password);
  await page.locator('[data-testid="login-submit"]').click();

  // Wait for home page — confirms auth is fully established and localStorage is populated
  await expect(page).toHaveURL(/\/home/, { timeout: 60000 });

  await page.context().storageState({ path: ADMIN_AUTH_FILE });
});
