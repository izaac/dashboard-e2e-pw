import { test as setup, expect } from '@playwright/test';

const authFile = '.auth/user.json';

/**
 * Auth setup — runs once before all authenticated tests.
 * Performs a single UI login and saves storageState for reuse.
 */
setup('authenticate', async ({ page }) => {
  const username = process.env.TEST_USERNAME || 'admin';
  const password = process.env.CATTLE_BOOTSTRAP_PASSWORD || process.env.TEST_PASSWORD || '';

  // Use relative path so baseURL subpath (/dashboard/) is preserved
  await page.goto('./auth/login', { waitUntil: 'domcontentloaded' });

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
  await page.locator('[data-testid="local-login-password"] input').fill(password);

  // Submit
  await page.locator('[data-testid="login-submit"]').click();

  // Wait for navigation away from login
  await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 15000 });

  // Save signed-in state
  await page.context().storageState({ path: authFile });
});
