import { test, expect } from '@/support/fixtures';
import AccessibilityPo from '@/e2e/po/components/accessibility.po';
import PagePo from '@/e2e/po/pages/page.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';

const pages = [
  { title: 'Account and API Keys page', path: '/account' },
  { title: 'User preferences page', path: '/prefs' },
  { title: 'Home page', path: '/home' },
  { title: 'Branding configuration page', path: '/c/local/manager/pages/branding' },
  { title: 'Extensions page', path: '/extensions' },
  { title: 'Repositories management page', path: '/c/local/manager/catalog.cattle.io.clusterrepo' },
  { title: 'Create user form', path: '/c/local/auth/management.cattle.io.user/create' },
  { title: 'Create secret form', path: '/c/local/explorer/secret/create' },
];

for (const theme of ['light', 'dark'] as const) {
  test.describe(`Color contrast of key pages (${theme} theme)`, { tag: ['@generic', '@adminUser'] }, () => {
    test.beforeEach(async ({ page, login, envMeta }) => {
      await login();
      await new AccessibilityPo(page).themeCookie(theme, envMeta.baseUrl);
    });

    for (const { title, path } of pages) {
      test(`${title} satisfies color contrast in ${theme} theme`, async ({ page }) => {
        const accessibility = new AccessibilityPo(page);
        const target = new PagePo(page, path);

        await target.goTo();
        await new WelcomeDialogPo(page).dismissIfVisible();
        await expect(accessibility.mainContent()).toBeVisible();

        const violations = await accessibility.scanColorContrast();

        expect(violations).toEqual([]);
      });
    }
  });
}
