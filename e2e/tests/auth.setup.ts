import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { DEBOUNCE, VERY_LONG, LONG } from '@/support/timeouts';

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

const AUTH_MAX_ATTEMPTS = 3;
const AUTH_FORM_TIMEOUT = 30_000;
const AUTH_REDIRECT_TIMEOUT = VERY_LONG; // 60s for initial auth
const AUTH_BACKOFF_MS = 5_000;

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
 * Set auth-user-session-ttl-minutes to 0 (unlimited) so tokens created during
 * the suite never expire mid-run. Only affects new tokens — existing ones keep
 * their original TTL. The settings spec tests this value independently and
 * resets it, so no conflict.
 */
async function setUnlimitedSessionTTL(apiUrl: string, password: string, username: string): Promise<void> {
  const loginResp = await fetch(`${apiUrl}/v3-public/localProviders/local?action=login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, responseType: 'json' }),
    signal: AbortSignal.timeout(5_000),
  });

  const body = await loginResp.json().catch(() => ({}));

  if (!body.token) {
    console.warn('[auth.setup] Could not set session TTL — login failed');

    return;
  }

  const headers = { Authorization: `Bearer ${body.token}`, 'Content-Type': 'application/json' };

  // Read current value to preserve in logs
  const current = await fetch(`${apiUrl}/v3/settings/auth-user-session-ttl-minutes`, { headers }).then((r) =>
    r.json().catch(() => ({})),
  );

  if (current.value === '0') {
    return; // Already unlimited
  }

  console.log(
    `[auth.setup] Setting auth-user-session-ttl-minutes: ${current.value || current.default} → 0 (unlimited)`,
  );
  await fetch(`${apiUrl}/v3/settings/auth-user-session-ttl-minutes`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ ...current, value: '0' }),
  });
}

/** Dismiss consent banner if visible — branding tests may leave one behind */
async function dismissBanner(page: import('@playwright/test').Page): Promise<void> {
  const banner = page.locator('#banner-consent .banner-dialog');

  if (await banner.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await banner
      .locator('button')
      .click()
      .catch(() => {
        /* best effort */
      });
  }
}

/**
 * Authenticate as admin and persist session cookies + localStorage.
 * All tests in the 'chromium' project reuse this state via storageState,
 * skipping the login page entirely.
 *
 * Resilient to slow Rancher, consent banners, and transient redirect failures.
 * Retries up to AUTH_MAX_ATTEMPTS times with backoff.
 */
setup('authenticate as admin', async ({ page }) => {
  const meta = setup.info().project.metadata as Record<string, string>;
  const password = meta.password;
  const username = meta.username || 'admin';

  // Gate: ensure Rancher API is healthy before browser login attempt
  await waitForRancherReady(meta.api, password, username);

  // Prevent session expiry mid-suite — set TTL to unlimited before creating the auth token
  await setUnlimitedSessionTTL(meta.api, password, username);

  for (let attempt = 0; attempt < AUTH_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, AUTH_BACKOFF_MS * attempt));
      await page.context().clearCookies();
      await page.evaluate(() => {
        try {
          localStorage.clear();
        } catch {
          /* noop */
        }
        try {
          sessionStorage.clear();
        } catch {
          /* noop */
        }
      });
    }

    await page.goto('./auth/login', { waitUntil: 'domcontentloaded' });

    // Wait for login form to render
    const submitButton = page.locator('[data-testid="login-submit"]');

    try {
      await submitButton.waitFor({ state: 'visible', timeout: AUTH_FORM_TIMEOUT });
    } catch {
      // Form didn't appear — Rancher might still be starting
      if (attempt === AUTH_MAX_ATTEMPTS - 1) {
        throw new Error(`[auth.setup] Login form did not appear after ${AUTH_MAX_ATTEMPTS} attempts`);
      }
      continue;
    }

    const useLocal = page.locator('[data-testid="login-useLocal"]');

    if (await useLocal.isVisible({ timeout: DEBOUNCE }).catch(() => false)) {
      await useLocal.click();
      await submitButton.waitFor({ state: 'visible', timeout: AUTH_FORM_TIMEOUT });
    }

    await dismissBanner(page);

    await page
      .locator('[data-testid="local-login-username"] input, [data-testid="local-login-username"]')
      .last()
      .fill(username);
    await page.locator('[data-testid="local-login-password"] input').fill(password);

    await dismissBanner(page);

    await submitButton.click();

    // Wait for home page — confirms auth is fully established
    try {
      await expect(page).toHaveURL(/\/home/, { timeout: AUTH_REDIRECT_TIMEOUT });
      // Success — save storageState and exit
      await page.context().storageState({ path: ADMIN_AUTH_FILE });

      return;
    } catch {
      if (attempt === AUTH_MAX_ATTEMPTS - 1) {
        throw new Error(
          `[auth.setup] Login redirect failed after ${AUTH_MAX_ATTEMPTS} attempts. ` +
            `Last URL: ${page.url()}. Auth storageState could not be saved.`,
        );
      }
    }
  }
});
