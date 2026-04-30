import { test as setup, expect } from '@playwright/test';
import { SHORT_TIMEOUT_OPT } from '@/support/timeouts';

const authFile = '.auth/user.json';

/**
 * Auth setup — runs before all other tests.
 * Performs UI login and saves storageState for reuse.
 * Replaces the Cypress cy.login() + session caching pattern.
 */
setup('authenticate', async ({ page }) => {
  const baseURL = page.context().browser()?.version
    ? (process.env.TEST_BASE_URL || 'https://localhost:8005').replace(/\/$/, '')
    : (process.env.TEST_BASE_URL || 'https://localhost:8005').replace(/\/$/, '');

  const username = process.env.TEST_USERNAME || 'admin';
  const password = process.env.CATTLE_BOOTSTRAP_PASSWORD || process.env.TEST_PASSWORD || '';

  await page.goto('/auth/login');

  // Handle "use local" button if present (multi-provider login page)
  const useLocal = page.locator('[data-testid="login-useLocal"]');

  if (await useLocal.isVisible({ timeout: 3000 }).catch(() => false)) {
    await useLocal.click();
  }

  // Fill credentials
  await page
    .locator('[data-testid="local-login-username"] input, [data-testid="local-login-username"]')
    .last()
    .fill(username);
  await page
    .locator('[data-testid="local-login-password"] input, [data-testid="local-login-password"]')
    .last()
    .fill(password);

  // Submit
  await page.locator('[data-testid="login-submit"]').click();

  // Wait for navigation to complete (should land on /home or /dashboard)
  await expect(page).not.toHaveURL(/\/auth\/login/, SHORT_TIMEOUT_OPT);

  // Save signed-in state
  await page.context().storageState({ path: authFile });
});
