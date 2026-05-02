import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';
import AuthProviderPo, { AuthProvider } from '@/e2e/po/pages/users-and-auth/auth-provider.po';
import AzureadPo from '@/e2e/po/edit/auth/azuread.po';
import { interceptVersionAndSetToPrime } from '@/e2e/blueprints/global/prime-version-mock';

const PRIME_DOCS_BASE = 'https://documentation.suse.com/cloudnative/rancher-manager/';

test.describe('Prime Extension', { tag: ['@prime', '@generic', '@adminUser'] }, () => {
  test.describe.configure({ mode: 'serial' });

  test('should have prime doc link in the links panel', async ({ page, login }) => {
    await interceptVersionAndSetToPrime(page);
    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();
    await homePage.waitForPage();

    const firstSupportLink = homePage.supportLinks().nth(0);

    await expect(firstSupportLink).toHaveAttribute(
      'href',
      expect.stringMatching(new RegExp(`^${PRIME_DOCS_BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)),
    );
  });

  test('should have prime doc link in a page that renders a doc link from i18n', async ({ page, login }) => {
    await interceptVersionAndSetToPrime(page);
    await login();

    const authProviderPo = new AuthProviderPo(page, 'local');
    const azureadPo = new AzureadPo(page, 'local');

    await authProviderPo.goTo();
    await authProviderPo.waitForPage();
    await authProviderPo.selectProvider(AuthProvider.AZURE);
    await azureadPo.waitForPage();

    const bannerLink = azureadPo.permissionsWarningBanner().locator('a').first();

    await expect(bannerLink).toHaveAttribute(
      'href',
      expect.stringMatching(new RegExp(`^${PRIME_DOCS_BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)),
    );
  });
});
