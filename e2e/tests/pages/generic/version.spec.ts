import { test } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';

/**
 * Intercept the settings API and override the server-version value.
 * Must be called BEFORE navigation so the route handler is active.
 */
async function interceptAndChangeVersion(page: import('@playwright/test').Page, version: string): Promise<void> {
  await page.route('**/v1/management.cattle.io.settings?exclude=metadata.managedFields', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    const serverVersion = json.data.find((s: any) => s.id === 'server-version');

    if (serverVersion) {
      serverVersion.value = version;
    }

    await route.fulfill({ json });
  });
}

test.describe('App Bar Version Number', { tag: ['@generic', '@adminUser', '@standardUser'] }, () => {
  test('app bar shows version number', async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);
    const nav = new ProductNavPo(page);

    await homePage.goTo();

    await nav.version().checkExists();
    await nav.version().checkVisible();
  });

  test('app bar shows short version number', async ({ page, login }) => {
    await login();
    await interceptAndChangeVersion(page, 'v2.9.0');

    const homePage = new HomePagePo(page);
    const nav = new ProductNavPo(page);

    await homePage.goTo();

    await nav.version().checkExists();
    await nav.version().checkVisible();
    await nav.version().checkVersion('v2.9');
    await nav.version().checkNormalText();
  });

  test('app bar shows full version number', async ({ page, login }) => {
    await login();
    await interceptAndChangeVersion(page, 'v2.9.1');

    const homePage = new HomePagePo(page);
    const nav = new ProductNavPo(page);

    await homePage.goTo();

    await nav.version().checkExists();
    await nav.version().checkVisible();
    await nav.version().checkVersion('v2.9.1');
    await nav.version().checkNormalText();
  });

  test('app bar shows "About" for dev version', async ({ page, login }) => {
    await login();
    await interceptAndChangeVersion(page, '12345678');

    const homePage = new HomePagePo(page);
    const nav = new ProductNavPo(page);

    await homePage.goTo();

    await nav.version().checkExists();
    await nav.version().checkVisible();
    await nav.version().checkVersion('About');
    await nav.version().checkNormalText();
  });

  test('app bar uses smaller text for longer version', async ({ page, login }) => {
    await login();
    await interceptAndChangeVersion(page, 'v2.10.11');

    const homePage = new HomePagePo(page);
    const nav = new ProductNavPo(page);

    await homePage.goTo();

    await nav.version().checkExists();
    await nav.version().checkVisible();
    await nav.version().checkVersion('v2.10.11');
    await nav.version().checkSmallText();
  });
});
