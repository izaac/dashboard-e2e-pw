import { test as base, expect, request as pwRequest } from '@playwright/test';
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
};

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
      }

      await use(api);
      await apiContext.dispose();
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

        // Race: either we land on home (storageState valid) or get redirected to login (invalid).
        // The SPA needs time to check auth and redirect, so we wait for EITHER outcome.
        const isLoginPage = await Promise.race([
          page
            .getByTestId('nav_header_showUserMenu')
            .waitFor({ state: 'visible', timeout: 15000 })
            .then(() => false),
          page
            .locator('[data-testid="login-submit"]')
            .waitFor({ state: 'visible', timeout: 15000 })
            .then(() => true),
        ]);

        if (!isLoginPage) {
          // DOM says we're logged in, but the SPA can render from cached Vuex state
          // even when R_SESS is expired. Verify with a real API call from the browser.
          const isSessionValid = await page.evaluate(async () => {
            try {
              const resp = await fetch('./v1/management.cattle.io.settings/server-version', {
                credentials: 'include',
              });

              return resp.ok;
            } catch {
              return false;
            }
          });

          if (isSessionValid) {
            return;
          }

          // Session expired — fall through to re-login
          await page.goto('./auth/login', { waitUntil: 'domcontentloaded' });
        }
      } else {
        // Clear existing auth state when logging in as a different user
        await page.context().clearCookies();
        await page.goto('./auth/login', { waitUntil: 'domcontentloaded' });
      }

      const useLocal = page.locator('[data-testid="login-useLocal"]');

      if (await useLocal.isVisible({ timeout: 3000 }).catch(() => false)) {
        await useLocal.click();
      }

      // Dismiss consent banner if present (branding tests may leave one behind)
      const consentBanner = page.locator('#banner-consent .banner-dialog');

      if (await consentBanner.isVisible({ timeout: 2000 }).catch(() => false)) {
        await consentBanner.locator('button').click();
      }

      await page
        .locator('[data-testid="local-login-username"] input, [data-testid="local-login-username"]')
        .last()
        .fill(username);
      await page.locator('[data-testid="local-login-password"] input').fill(password);

      // Re-check consent banner — it may appear after page load (lazy rendering)
      if (await consentBanner.isVisible({ timeout: 500 }).catch(() => false)) {
        await consentBanner.locator('button').click();
      }

      // Listen for the login POST response BEFORE clicking submit.
      // This mirrors Cypress `cy.wait('@loginReq')` — guarantees R_SESS cookie
      // is set before we proceed (the URL may change before Set-Cookie is processed).
      const loginResponse = page.waitForResponse(
        (resp) =>
          (resp.url().includes('/v3-public/localProviders/local') || resp.url().includes('/v1-public/login')) &&
          resp.request().method() === 'POST',
      );

      await page.locator('[data-testid="login-submit"]').click();
      await loginResponse;

      // Wait for the SPA to navigate away from the login page
      await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 60000 });
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
