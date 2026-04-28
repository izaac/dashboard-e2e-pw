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
const FORM_READY_TIMEOUT = 30_000; // Rancher can be very slow after heavy tests
const LOGIN_REDIRECT_TIMEOUT = 30_000; // SPA redirect after successful login POST (slow Docker needs headroom)
const SESSION_RACE_TIMEOUT = 45_000; // storageState validity race (slow Docker)
const BACKOFF_BASE_MS = 3_000; // Exponential backoff: 3s, 6s, 12s
const BANNER_CHECK_MS = 1_000; // Quick check for consent banner

/** Clear all browser state — cookies, localStorage, sessionStorage */
async function resetBrowserState(page: Page): Promise<void> {
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

/** Dismiss consent banner if visible — branding tests may leave one behind */
async function dismissConsentBanner(page: Page): Promise<void> {
  const banner = page.locator('#banner-consent .banner-dialog');

  if (await banner.isVisible({ timeout: BANNER_CHECK_MS }).catch(() => false)) {
    await banner
      .locator('button')
      .click()
      .catch(() => {
        /* best effort */
      });
  }
}

/**
 * Fill credentials and submit the login form.
 *
 * Resilient to: slow Rancher (extended timeouts), consent banners,
 * login POST failures, SPA redirect failures. Retries with exponential
 * backoff and clean browser state up to MAX_LOGIN_ATTEMPTS times.
 *
 * Expects to be on /auth/login with the standard login form (username + password).
 * Throws a clear error if the page is in an unexpected state (bootstrap, setup).
 */
async function performLogin(page: Page, username: string, password: string, attempt = 0): Promise<void> {
  if (attempt >= MAX_LOGIN_ATTEMPTS) {
    throw new Error(
      `Login failed after ${MAX_LOGIN_ATTEMPTS} attempts. ` +
        `Last URL: ${page.url()}. ` +
        `Possible causes: Rancher unresponsive, invalid credentials, or stale session loop.`,
    );
  }

  // Backoff between retries — gives Rancher time to stabilize after controller churn
  if (attempt > 0) {
    await new Promise((r) => setTimeout(r, BACKOFF_BASE_MS * Math.pow(2, attempt - 1)));
    await resetBrowserState(page);
    await page.goto('./auth/login', { waitUntil: 'domcontentloaded' });
  }

  // ── 1. Wait for the login form to fully render ────────────────────────────
  const submitButton = page.getByTestId('login-submit');

  try {
    await submitButton.waitFor({ state: 'visible', timeout: FORM_READY_TIMEOUT });
  } catch {
    // Form didn't appear — Rancher might be starting up or stuck in a loading state
    return performLogin(page, username, password, attempt + 1);
  }

  // Detect bootstrap page (no username field) — setup spec should have handled this
  const bootstrapMessage = page.getByTestId('first-login-message');

  if (await bootstrapMessage.isVisible({ timeout: 500 }).catch(() => false)) {
    throw new Error(
      'Login page shows bootstrap form (first login). ' +
        'Rancher has not been configured yet — run the setup project first or set CATTLE_BOOTSTRAP_PASSWORD.',
    );
  }

  // Detect if we somehow landed on /auth/setup
  if (page.url().includes('/auth/setup')) {
    throw new Error(
      'Redirected to /auth/setup — admin password has not been set. ' +
        'Run the setup project first or set CATTLE_BOOTSTRAP_PASSWORD.',
    );
  }

  // ── 2. Handle multi-provider login page ───────────────────────────────────
  const useLocal = page.getByTestId('login-useLocal');

  if (await useLocal.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await useLocal.click();
  }

  // ── 3. Wait for the local-login form fields (not just submit button) ──────
  // LabeledInput uses inheritAttrs:false + v-bind="$attrs" on <input>, so testid is ON the input
  const usernameField = page.getByTestId('local-login-username');

  try {
    await usernameField.waitFor({ state: 'visible', timeout: FORM_READY_TIMEOUT });
  } catch {
    // Username field didn't appear — might be bootstrap page or loading
    return performLogin(page, username, password, attempt + 1);
  }

  // ── 4. Dismiss consent banner ─────────────────────────────────────────────
  await dismissConsentBanner(page);

  // ── 5. Fill credentials ───────────────────────────────────────────────────
  // Password wraps LabeledInput with default inheritAttrs, so testid is on the wrapper div
  await usernameField.fill(username);
  await page.getByTestId('local-login-password').locator('input').fill(password);

  // Re-check banner — can appear after page renders more content
  await dismissConsentBanner(page);

  // ── 6. Submit and wait for login POST response ────────────────────────────
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
    // Login POST never came back — network issue or server crash
    return performLogin(page, username, password, attempt + 1);
  }

  // 401/403 = deterministic auth failure — retrying won't help
  if (resp.status() === 401 || resp.status() === 403) {
    throw new Error(`Login rejected with ${resp.status()} — check credentials for user '${username}'.`);
  }

  // 5xx = transient server error — retry after backoff
  if (resp.status() >= 500) {
    return performLogin(page, username, password, attempt + 1);
  }

  // ── 6. Wait for SPA to redirect away from /auth/login ────────────────────
  try {
    await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: LOGIN_REDIRECT_TIMEOUT });
  } catch {
    // Redirect failed — but POST was 2xx so the cookie might be set.
    // Verify actual auth state before throwing away the session.
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
      // Session IS valid — the SPA router just didn't redirect. Navigate manually.
      await page.goto('./home', { waitUntil: 'domcontentloaded' });

      try {
        await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: FORM_READY_TIMEOUT });

        return; // Successfully recovered
      } catch {
        // Manual navigation also failed — fall through to retry
      }
    }

    // Session is genuinely invalid or unrecoverable — retry with clean state
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

      // With storageState pre-loaded, navigate to home and check if already authenticated
      const storageState = testInfo.project.use?.storageState;
      const hasStorageState = typeof storageState === 'string' && storageState.length > 0;

      if (hasStorageState && !options) {
        await page.goto('./home', { waitUntil: 'domcontentloaded' });

        // Race: home (session valid) | login (expired) | setup (not configured) | timeout (slow/stuck)
        let pageState: 'home' | 'login' | 'setup' | 'timeout';

        try {
          pageState = await Promise.race([
            page
              .getByTestId('nav_header_showUserMenu')
              .waitFor({ state: 'visible', timeout: SESSION_RACE_TIMEOUT })
              .then(() => 'home' as const),
            page
              .getByTestId('login-submit')
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
          // DOM says we're logged in, but the SPA can render from cached Vuex state
          // even when R_SESS is expired. Verify with a real API call from the browser.
          // Retry once on transient failures (5xx, network blip) to avoid nuking valid state.
          for (let probe = 0; probe < 2; probe++) {
            const probeResult = await page.evaluate(async () => {
              try {
                const resp = await fetch('./v1/management.cattle.io.settings/server-version', {
                  credentials: 'include',
                });

                return resp.status;
              } catch {
                return 0; // network error
              }
            });

            if (probeResult >= 200 && probeResult < 300) {
              return; // Session confirmed valid
            }

            if (probeResult === 401 || probeResult === 403) {
              break; // Deterministic auth failure — don't retry
            }

            // Transient error (5xx, network) — wait briefly and retry once
            if (probe === 0) {
              await new Promise((r) => setTimeout(r, 2_000));
            }
          }
        }

        // Session invalid, on login page, setup page, or timeout — clear state and do fresh login
        await resetBrowserState(page);
        await page.goto('./auth/login', { waitUntil: 'domcontentloaded' });
      } else {
        // Clear existing auth state when logging in as a different user or without storageState
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
