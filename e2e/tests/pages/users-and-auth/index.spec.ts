import { test, expect } from '@/support/fixtures';

test.describe('Auth Index', { tag: ['@usersAndAuths', '@adminUser'] }, () => {
  test('can redirect', async ({ page, login }) => {
    await login();

    await page.goto('./c/local/auth', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/c\/local\/auth\/management\.cattle\.io\.user/);
  });
});
