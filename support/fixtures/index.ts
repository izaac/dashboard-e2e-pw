import { test as base, expect, request as pwRequest } from '@playwright/test';
import { RancherApi } from './rancher-api';
import type { TestEnvMetadata } from '@/globals';
import * as fs from 'fs';
import * as path from 'path';

type RancherTestFixtures = {
  envMeta: TestEnvMetadata;
  login: (options?: { username?: string; password?: string }) => Promise<void>;
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

      await page.goto('./auth/login', { waitUntil: 'domcontentloaded' });

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
      await page.locator('[data-testid="login-submit"]').click();

      // The login POST may take time on busy servers. Wait up to 60s for the URL
      // to change. If the SPA router gets stuck (e.g. due to websocket reconnection
      // loops), navigate to the home page directly after confirming we're past
      // the initial login spinner.
      await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 60000 });
    };

    await use(doLogin);
  },
});

export { expect };
