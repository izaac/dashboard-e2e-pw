import { test, expect } from '@/support/fixtures';
import { LoginPagePo } from '@/e2e/po/pages/login-page.po';

test.describe('Global UI', { tag: ['@generic', '@adminUser', '@standardUser'] }, () => {
  test.describe('Favicons', () => {
    test('Should display png favicon', async ({ page }) => {
      const loginPage = new LoginPagePo(page);

      await loginPage.goTo();

      await expect(loginPage.faviconLink()).toHaveAttribute('href', expect.stringContaining('/favicon.png'));
    });

    test('Should have correct set of favicons', async ({ page }) => {
      const loginPage = new LoginPagePo(page);

      await loginPage.goTo();

      const faviconLink = loginPage.faviconLink();

      await expect(faviconLink).toHaveAttribute('href', expect.stringContaining('/favicon.png'));

      // Verify the favicon is fetchable
      const href = await faviconLink.getAttribute('href');
      const response = await page.request.get(href!);

      expect(response.ok()).toBe(true);
      expect(response.headers()['content-type']).toContain('image/png');
    });
  });
});
