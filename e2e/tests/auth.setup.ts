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
 * Authenticate as admin and persist session cookies + localStorage.
 * All tests in the 'chromium' project reuse this state via storageState,
 * skipping the login page entirely.
 */
setup('authenticate as admin', async ({ page }) => {
  const meta = setup.info().project.metadata as Record<string, string>;
  const password = meta.password;
  const username = meta.username || 'admin';

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
