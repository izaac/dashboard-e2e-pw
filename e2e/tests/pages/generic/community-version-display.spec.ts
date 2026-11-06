import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';
import AboutPagePo from '@/e2e/po/pages/about.po';
import ProductNavPo from '@/e2e/po/side-bars/product-side-nav.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';

test.describe('Community Version Display', { tag: ['@generic', '@adminUser'] }, () => {
  let initialServerVersion: string;
  let minorLine: string;
  let zeroVersion: string;
  let expectedShortVersion: string;
  let patchVersion: string;

  test.beforeAll(async ({ rancherApi }) => {
    const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'server-version');

    initialServerVersion = resp.body.value ?? '';

    // Dynamically derive the minor line from the cluster version (e.g. "v2.16-xxx-head" -> "2.16")
    const match = initialServerVersion.match(/^v?(\d+\.\d+)/);

    minorLine = match ? match[1] : '2.16';
    zeroVersion = `v${minorLine}.0`;
    expectedShortVersion = `v${minorLine}`;
    patchVersion = `v${minorLine}.1`;
  });

  test.afterAll(async ({ rancherApi }) => {
    const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'server-version');

    await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'server-version', {
      ...resp.body,
      value: initialServerVersion,
    });
  });

  test('Community build trims zero patch level in navigation rail and About page', async ({
    page,
    login,
    rancherApi,
    isPrime,
  }) => {
    test.skip(isPrime, 'Validates Community version trimming only');

    const setting = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'server-version');

    await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'server-version', {
      ...setting.body,
      value: zeroVersion,
    });

    await login();

    const homePage = new HomePagePo(page);
    const nav = new ProductNavPo(page);

    await homePage.goTo();
    await expect(nav.version().self()).toBeVisible();
    await expect(nav.version().self()).toContainText(expectedShortVersion);
    await expect(nav.version().self()).not.toContainText(zeroVersion);

    const aboutPage = new AboutPagePo(page);

    await aboutPage.goTo();
    await expect(aboutPage.rancherVersionValue()).toBeVisible();
    await expect(aboutPage.rancherVersionValue()).toHaveText(expectedShortVersion);
  });

  test('Community build retains non-zero patch level in navigation rail and About page', async ({
    page,
    login,
    rancherApi,
    isPrime,
  }) => {
    test.skip(isPrime, 'Validates Community version trimming only');

    const setting = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'server-version');

    await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'server-version', {
      ...setting.body,
      value: patchVersion,
    });

    await login();

    const aboutPage = new AboutPagePo(page);

    await aboutPage.goTo();
    await expect(aboutPage.rancherVersionValue()).toBeVisible();
    await expect(aboutPage.rancherVersionValue()).toHaveText(patchVersion);

    const homePage = new HomePagePo(page);
    const nav = new ProductNavPo(page);

    await homePage.goTo();
    await expect(nav.version().self()).toBeVisible();
    await expect(nav.version().self()).toContainText(patchVersion);
  });

  test('Prime build retains zero patch level in navigation rail and About page', async ({
    page,
    login,
    rancherApi,
    isPrime,
  }) => {
    test.skip(!isPrime, 'Validates Prime version display only');

    const setting = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'server-version');

    await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'server-version', {
      ...setting.body,
      value: zeroVersion,
    });

    await login();

    const welcome = new WelcomeDialogPo(page);
    const aboutPage = new AboutPagePo(page);

    await aboutPage.goTo();
    await welcome
      .self()
      .waitFor({ state: 'visible', timeout: 3000 })
      .catch(() => {});
    await welcome.dismissIfVisible();

    await expect(aboutPage.rancherVersionValue()).toBeVisible();
    await expect(aboutPage.rancherVersionValue()).toHaveText(zeroVersion);

    const homePage = new HomePagePo(page);
    const burger = new BurgerMenuPo(page);

    await homePage.goTo();
    await welcome
      .self()
      .waitFor({ state: 'visible', timeout: 3000 })
      .catch(() => {});
    await welcome.dismissIfVisible();

    await burger.open();
    await expect(burger.versionLink()).toBeVisible();
    await expect(burger.versionLink()).toHaveText(zeroVersion);
  });
});
