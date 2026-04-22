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
 * Ensure standard_user exists with global 'user' role and project-member on local/Default.
 * Idempotent: skips if user already exists. Uses raw fetch (no rancherApi fixture available).
 */
async function ensureStandardUser(apiUrl: string, cookie: string, password: string): Promise<void> {
  const headers = { Cookie: cookie, 'Content-Type': 'application/json', Accept: 'application/json' };

  // Check if standard_user already exists
  const usersResp = await fetch(`${apiUrl}/v1/management.cattle.io.users`, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });

  if (!usersResp.ok) {
    console.warn(`[auth.setup] Could not list users (${usersResp.status}), skipping standard_user ensure`);

    return;
  }

  const users = await usersResp.json();
  const existing = users.data?.find((u: { username?: string }) => u.username === 'standard_user');

  if (existing) {
    console.log('[auth.setup] standard_user already exists, skipping creation');

    return;
  }

  console.log('[auth.setup] Creating standard_user...');

  // Create user
  const createResp = await fetch(`${apiUrl}/v1/management.cattle.io.users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'user', enabled: true, mustChangePassword: false, username: 'standard_user' }),
  });

  if (!createResp.ok) {
    throw new Error(`Failed to create standard_user: ${createResp.status} ${await createResp.text()}`);
  }

  const user = await createResp.json();
  const userId = user.id;

  // Wait for principalIds to populate
  await new Promise((r) => setTimeout(r, 500));

  const userDataResp = await fetch(`${apiUrl}/v1/management.cattle.io.users/${userId}`, { headers });
  const userData = await userDataResp.json();
  const principalId = userData.principalIds?.[0];

  // Set password
  await fetch(`${apiUrl}/v1/secrets`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      type: 'secret',
      metadata: { namespace: 'cattle-local-user-passwords', name: userId },
      data: { password: Buffer.from(password).toString('base64') },
    }),
  });

  // Global role binding: 'user'
  await fetch(`${apiUrl}/v3/globalrolebindings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'globalRoleBinding', globalRoleId: 'user', userId }),
  });

  // Project role binding: project-member on local/Default
  if (principalId) {
    const projResp = await fetch(`${apiUrl}/v3/projects?name=Default&clusterId=local`, { headers });
    const projData = await projResp.json();
    const projectId = projData.data?.[0]?.id;

    if (projectId) {
      await fetch(`${apiUrl}/v3/projectroletemplatebindings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'projectroletemplatebinding',
          roleTemplateId: 'project-member',
          userPrincipalId: principalId,
          projectId,
        }),
      });
    }
  }

  console.log('[auth.setup] standard_user created successfully');
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

  // Ensure standard_user exists (idempotent) — needs admin session cookie
  const loginResp = await fetch(`${meta.api}/v3-public/localProviders/local?action=login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, responseType: 'cookie' }),
  });
  const sessCookie = loginResp.headers
    .getSetCookie?.()
    .find((c) => c.startsWith('R_SESS='))
    ?.split(';')[0];

  if (sessCookie) {
    await ensureStandardUser(meta.api, sessCookie, password);
  }
});
