import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';

const PRIME_DOCS_BASE = 'https://documentation.suse.com/cloudnative/rancher-manager/';

/** Intercept /rancherversion to mock Prime mode */
async function interceptVersionAndSetToPrime(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/rancherversion', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        Version: '9bf6631da',
        GitCommit: '9bf6631da',
        RancherPrime: 'true',
      }),
    }),
  );
}

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

  // Skip auth provider test — AuthProviderPo and AzureadPo not yet converted
  test.skip('should have prime doc link in a page that renders a doc link from i18n', async () => {
    // Requires AuthProviderPo and AzureadPo POs which are not yet available
  });
});
