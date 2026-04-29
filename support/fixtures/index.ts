import { test as base, expect, request as pwRequest } from '@playwright/test';
import type { Page } from '@playwright/test';
import { RancherApi } from './rancher-api';
import type { TestEnvMetadata } from '@/globals';
import * as fs from 'fs';
import * as path from 'path';

type ChartGuardFn = (repo: string, chartId: string) => Promise<void>;

type RancherTestFixtures = {
  envMeta: TestEnvMetadata;
  login: (options?: { username?: string; password?: string }) => Promise<void>;
  chartGuard: ChartGuardFn;
};

type RancherWorkerFixtures = {
  rancherApi: RancherApi;
  isPrime: boolean;
};

// ── Login resilience constants ──────────────────────────────────────────────
const MAX_LOGIN_ATTEMPTS = 3;
const FORM_READY_TIMEOUT = 30_000;
const LOGIN_REDIRECT_TIMEOUT = 30_000;
const SESSION_RACE_TIMEOUT = 45_000;
const BACKOFF_BASE_MS = 3_000;
const BANNER_CHECK_MS = 1_000;

/** Clear all browser state — cookies, localStorage, sessionStorage */
async function resetBrowserState(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      // Throws in restricted contexts (about:blank, sandboxed iframes)
    }
    try {
      sessionStorage.clear();
    } catch {
      // Throws in restricted contexts (about:blank, sandboxed iframes)
    }
  });
}

/** Dismiss consent banner if visible — branding tests may leave one behind */
async function dismissConsentBanner(page: Page): Promise<void> {
  const banner = page.locator('#banner-consent .banner-dialog');

  if (await banner.isVisible({ timeout: BANNER_CHECK_MS }).catch(() => false)) {
    await banner
      .locator('button')
      .click()
      .catch(() => {
        // Banner can disappear between isVisible check and click — safe to ignore
      });
  }
}

/**
 * Fill credentials and submit the login form.
 *
 * Resilient to: slow Rancher (extended timeouts), consent banners,
 * login POST failures, SPA redirect failures. Retries with exponential
 * backoff and clean browser state up to MAX_LOGIN_ATTEMPTS times.
 */
async function performLogin(page: Page, username: string, password: string, attempt = 0): Promise<void> {
  if (attempt >= MAX_LOGIN_ATTEMPTS) {
    throw new Error(
      `Login failed after ${MAX_LOGIN_ATTEMPTS} attempts. ` +
        `Last URL: ${page.url()}. ` +
        `Possible causes: Rancher unresponsive, invalid credentials, or stale session loop.`,
    );
  }

  if (attempt > 0) {
    await new Promise((r) => setTimeout(r, BACKOFF_BASE_MS * Math.pow(2, attempt - 1)));
    await resetBrowserState(page);
    await page.goto('./auth/login', { waitUntil: 'domcontentloaded' });
  }

  // ── 1. Wait for login form to render ──────────────────────────────────────
  const submitButton = page.locator('[data-testid="login-submit"]');

  try {
    await submitButton.waitFor({ state: 'visible', timeout: FORM_READY_TIMEOUT });
  } catch {
    return performLogin(page, username, password, attempt + 1);
  }

  // Detect bootstrap/setup page
  if (page.url().includes('/auth/setup')) {
    throw new Error('Redirected to /auth/setup — run setup project first.');
  }

  const bootstrapMessage = page.getByTestId('first-login-message');

  if (await bootstrapMessage.isVisible({ timeout: 500 }).catch(() => false)) {
    throw new Error('Login page shows bootstrap form — Rancher not configured.');
  }

  // ── 2. Handle multi-provider login page ───────────────────────────────────
  const useLocal = page.locator('[data-testid="login-useLocal"]');

  if (await useLocal.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await useLocal.click();
  }

  // ── 3. Wait for username field ────────────────────────────────────────────
  // v2.14: testid is on wrapper div, input is a child
  const usernameField = page
    .locator('[data-testid="local-login-username"] input, [data-testid="local-login-username"]')
    .last();

  try {
    await usernameField.waitFor({ state: 'visible', timeout: FORM_READY_TIMEOUT });
  } catch {
    return performLogin(page, username, password, attempt + 1);
  }

  // ── 4. Dismiss consent banner ─────────────────────────────────────────────
  await dismissConsentBanner(page);

  // ── 5. Fill credentials ───────────────────────────────────────────────────
  await usernameField.fill(username);
  await page.locator('[data-testid="local-login-password"] input').fill(password);

  await dismissConsentBanner(page);

  // ── 6. Submit and wait for login POST ─────────────────────────────────────
  const loginResponse = page.waitForResponse(
    (resp) =>
      (resp.url().includes('/v3-public/localProviders/local') || resp.url().includes('/v1-public/login')) &&
      resp.request().method() === 'POST',
    { timeout: FORM_READY_TIMEOUT },
  );

  await submitButton.click();

  let resp;

  try {
    resp = await loginResponse;
  } catch {
    return performLogin(page, username, password, attempt + 1);
  }

  if (resp.status() === 401 || resp.status() === 403) {
    throw new Error(`Login rejected with ${resp.status()} — check credentials for user '${username}'.`);
  }

  if (resp.status() >= 500) {
    return performLogin(page, username, password, attempt + 1);
  }

  // ── 7. Wait for SPA redirect away from /auth/login ────────────────────────
  try {
    await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: LOGIN_REDIRECT_TIMEOUT });
  } catch {
    const isAuthenticated = await page
      .evaluate(async () => {
        try {
          const r = await fetch('./v1/management.cattle.io.settings/server-version', { credentials: 'include' });

          return r.ok;
        } catch {
          return false;
        }
      })
      .catch(() => false);

    if (isAuthenticated) {
      await page.goto('./home', { waitUntil: 'domcontentloaded' });

      try {
        await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: FORM_READY_TIMEOUT });

        return;
      } catch {
        // Fall through to retry
      }
    }

    return performLogin(page, username, password, attempt + 1);
  }
}

export const test = base.extend<RancherTestFixtures, RancherWorkerFixtures>({
  /** Auto-capture console logs, network requests, and attach debug artifacts on failure */
  page: async ({ page }, use, testInfo) => {
    const consoleLogs: string[] = [];
    const networkLogs: string[] = [];

    page.on('console', (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    page.on('pageerror', (err) => {
      consoleLogs.push(`[PAGE ERROR] ${err.message}`);
    });

    // Track API requests — log failures for debugging
    page.on('response', (response) => {
      const status = response.status();

      if (status >= 400) {
        networkLogs.push(`[${status}] ${response.request().method()} ${response.url()}`);
      }
    });

    await use(page);

    // On failure: attach rich debugging artifacts agents can parse as text
    if (testInfo.status !== testInfo.expectedStatus) {
      fs.mkdirSync(testInfo.outputDir, { recursive: true });

      // 1. Console logs
      if (consoleLogs.length > 0) {
        const logsPath = path.join(testInfo.outputDir, 'console-logs.txt');

        fs.writeFileSync(logsPath, consoleLogs.join('\n'));
        await testInfo.attach('console-logs', { path: logsPath, contentType: 'text/plain' });
      }

      // 2. Network logs (failed/slow requests)
      if (networkLogs.length > 0) {
        const netPath = path.join(testInfo.outputDir, 'network-errors.txt');

        fs.writeFileSync(netPath, networkLogs.join('\n'));
        await testInfo.attach('network-errors', { path: netPath, contentType: 'text/plain' });
      }

      // 3. DOM snapshot — truncated to 50KB
      try {
        const html = await page.evaluate(() => document.body?.innerHTML?.substring(0, 50_000) || '');
        const domPath = path.join(testInfo.outputDir, 'dom-snapshot.html');

        fs.writeFileSync(domPath, html);
        await testInfo.attach('dom-snapshot', { path: domPath, contentType: 'text/html' });
      } catch {
        /* page may have crashed */
      }

      // 4. Error context summary — single text file with everything agents need
      try {
        const contextLines = [
          `Test: ${testInfo.title}`,
          `File: ${testInfo.file}`,
          `Status: ${testInfo.status}`,
          `URL at failure: ${page.url()}`,
          `Duration: ${testInfo.duration}ms`,
          `Retry: ${testInfo.retry}`,
          '',
          '--- Error ---',
          testInfo.error?.message || 'No error message',
          '',
          '--- Stack ---',
          testInfo.error?.stack?.substring(0, 3000) || 'No stack trace',
          '',
          '--- Last 30 Console Lines ---',
          ...consoleLogs.slice(-30),
          '',
          '--- Failed/Slow Network Requests ---',
          ...(networkLogs.length > 0 ? networkLogs.slice(-50) : ['None']),
        ];
        const contextPath = path.join(testInfo.outputDir, 'error-context.md');

        fs.writeFileSync(contextPath, contextLines.join('\n'));
        await testInfo.attach('error-context', { path: contextPath, contentType: 'text/plain' });
      } catch {
        /* best effort */
      }
    }
  },

  rancherApi: [
    async ({}, use, workerInfo) => {
      const meta = workerInfo.project.metadata as TestEnvMetadata;

      const apiContext = await pwRequest.newContext({
        baseURL: meta.api,
        ignoreHTTPSErrors: true,
      });

      const api = new RancherApi(apiContext, meta.api);

      if (meta.password) {
        await api.login(meta.username, meta.password);
        await api.waitForReady();
        await api.ensureStandardUser(meta.password);
      }

      await use(api);
      await apiContext.dispose();
    },
    { scope: 'worker' },
  ],

  isPrime: [
    async ({ rancherApi }, use) => {
      const version = await rancherApi.getRancherVersion();

      await use(version.RancherPrime === 'true');
    },
    { scope: 'worker' },
  ],

  envMeta: async ({}, use, testInfo) => {
    await use(testInfo.project.metadata as TestEnvMetadata);
  },

  login: async ({ page }, use, testInfo) => {
    const meta = testInfo.project.metadata as TestEnvMetadata;

    const doLogin = async (options?: { username?: string; password?: string }) => {
      const username = options?.username || meta.username;
      const password = options?.password || meta.password;

      const storageState = testInfo.project.use?.storageState;
      const hasStorageState = typeof storageState === 'string' && storageState.length > 0;

      if (hasStorageState && !options) {
        await page.goto('./home', { waitUntil: 'domcontentloaded' });

        // Race: home (valid) | login (expired) | setup (not configured) | timeout
        let pageState: 'home' | 'login' | 'setup' | 'timeout';

        try {
          pageState = await Promise.race([
            page
              .getByTestId('nav_header_showUserMenu')
              .waitFor({ state: 'visible', timeout: SESSION_RACE_TIMEOUT })
              .then(() => 'home' as const),
            page
              .locator('[data-testid="login-submit"]')
              .waitFor({ state: 'visible', timeout: SESSION_RACE_TIMEOUT })
              .then(() => 'login' as const),
            page
              .getByTestId('setup-submit')
              .waitFor({ state: 'visible', timeout: SESSION_RACE_TIMEOUT })
              .then(() => 'setup' as const),
          ]);
        } catch {
          pageState = 'timeout';
        }

        if (pageState === 'home') {
          // Verify session with real API call — Vuex can render from stale cache
          for (let probe = 0; probe < 2; probe++) {
            const probeResult = await page.evaluate(async () => {
              try {
                const resp = await fetch('./v1/management.cattle.io.settings/server-version', {
                  credentials: 'include',
                });

                return resp.status;
              } catch {
                return 0;
              }
            });

            if (probeResult >= 200 && probeResult < 300) {
              return; // Session confirmed valid
            }

            if (probeResult === 401 || probeResult === 403) {
              break; // Deterministic auth failure
            }

            // Transient error — wait and retry once
            if (probe === 0) {
              await new Promise((r) => setTimeout(r, 2_000));
            }
          }
        }

        // Session invalid or unexpected page — clear state and do fresh login
        await resetBrowserState(page);
        await page.goto('./auth/login', { waitUntil: 'domcontentloaded' });
      } else {
        await page.context().clearCookies();
        await page.goto('./auth/login', { waitUntil: 'domcontentloaded' });
      }

      await performLogin(page, username, password);
    };

    await use(doLogin);
  },

  /**
   * Chart availability guard — sets `show-pre-release` preference, checks the catalog
   * index, and skips/fails the test based on chart presence.
   *
   * Usage: `await chartGuard('rancher-charts', 'rancher-backup');`
   *
   * - Chart available → test proceeds
   * - Chart filtered by catalog rules → test.skip()
   * - Catalog empty/broken → throws (hard fail)
   *
   * Preference is restored on teardown. Index results are cached on the worker-scoped
   * rancherApi instance so the catalog is fetched at most once per repo per worker.
   */
  chartGuard: async ({ rancherApi }, use) => {
    await rancherApi.setUserPreference({ 'show-pre-release': 'true' });

    const guard: ChartGuardFn = async (repo: string, chartId: string) => {
      const presence = await rancherApi.checkChartPresence(repo, chartId);

      if (presence === 'catalog-error') {
        throw new Error(`Catalog index for '${repo}' is empty or unavailable — repo may not be synced`);
      }

      base.skip(presence === 'filtered', `Chart '${chartId}' not in filtered catalog for this environment`);
    };

    await use(guard);

    await rancherApi.setUserPreference({ 'show-pre-release': 'false' });
  },
});

export { expect };
