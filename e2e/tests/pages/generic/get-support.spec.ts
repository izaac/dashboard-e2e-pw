import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';
import SupportPagePo from '@/e2e/po/pages/get-support.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';

test.describe('Support Page', () => {
  test('can navigate to Support page', { tag: ['@generic', '@adminUser'] }, async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);
    const supportPage = new SupportPagePo(page);
    const burgerMenu = new BurgerMenuPo(page);

    await homePage.goTo();
    await homePage.waitForPage();

    await burgerMenu.toggle();
    await burgerMenu.support().click();
    await supportPage.waitForPage();
  });

  test(
    'standard user does not have access to Support page',
    { tag: ['@generic', '@standardUser'] },
    async ({ page, login, envMeta }) => {
      await login({ username: 'standard_user', password: envMeta.password });

      const homePage = new HomePagePo(page);
      const burgerMenu = new BurgerMenuPo(page);

      await homePage.goTo();
      await homePage.waitForPage();

      await burgerMenu.toggle();
      await expect(burgerMenu.support()).not.toBeAttached();
    },
  );

  test.describe('Support Links', { tag: ['@generic', '@adminUser'] }, () => {
    test('can click on Suse Rancher Support link', { tag: ['@noPrime'] }, async ({ page, login }) => {
      await login();

      const supportPage = new SupportPagePo(page);

      await supportPage.goTo();
      await supportPage.waitForPage();

      const link = supportPage.externalSupportLink(0);

      await expect(link).toHaveAttribute('href', expect.stringContaining('rancher.com/support'));
    });

    test('can click on Contact us for pricing link', { tag: ['@noPrime'] }, async ({ page, login }) => {
      await login();

      const supportPage = new SupportPagePo(page);

      await supportPage.goTo();
      await supportPage.waitForPage();

      const link = supportPage.externalSupportLink(1);

      await expect(link).toHaveAttribute('href', expect.stringContaining('pricing'));
    });

    test(
      'can click on Suse Customer Center link',
      { tag: ['@jenkins', '@prime', '@scc'] },
      async ({ page, login, rancherApi }) => {
        const version = await rancherApi.getRancherVersion();

        test.skip(version.RancherPrime !== 'true', 'Requires a Prime environment');
        await login();

        const supportPage = new SupportPagePo(page);

        await supportPage.goTo();
        await supportPage.waitForPage();

        await expect(supportPage.sccLink()).toHaveAttribute('href', 'https://scc.suse.com');
      },
    );

    test('can click on Docs link', async ({ page, login, rancherApi }) => {
      await login();

      const supportPage = new SupportPagePo(page);

      await supportPage.goTo();
      await supportPage.waitForPage();

      // Wait for support links to be visible
      await expect(supportPage.supportLinks().first()).toBeVisible();
      const count = await supportPage.supportLinks().count();

      expect(count).toBeGreaterThanOrEqual(5);

      const link = supportPage.supportLinks().nth(0);
      const version = await rancherApi.getRancherVersion();
      const expectedUrl =
        version.RancherPrime === 'true'
          ? 'documentation.suse.com/cloudnative/rancher-manager'
          : 'ranchermanager.docs.rancher.com';

      await expect(link).toHaveAttribute('href', expect.stringContaining(expectedUrl));
    });

    test('can click on Forums link', async ({ page, login }) => {
      await login();

      const supportPage = new SupportPagePo(page);

      await supportPage.goTo();
      await supportPage.waitForPage();

      const link = supportPage.supportLinks().nth(1);

      await expect(link).toHaveAttribute('href', expect.stringContaining('forums.suse.com'));
    });

    test('can click on Slack link', async ({ page, login }) => {
      await login();

      const supportPage = new SupportPagePo(page);

      await supportPage.goTo();
      await supportPage.waitForPage();

      const link = supportPage.supportLinks().nth(2);

      await expect(link).toHaveAttribute('href', expect.stringContaining('slack.rancher.io'));
    });

    test('can click on File an Issue link', async ({ page, login }) => {
      await login();

      const supportPage = new SupportPagePo(page);

      await supportPage.goTo();
      await supportPage.waitForPage();

      const link = supportPage.supportLinks().nth(3);

      await expect(link).toHaveAttribute('href', expect.stringContaining('github.com'));
    });

    test('can click on Get Started link', async ({ page, login }) => {
      await login();

      const supportPage = new SupportPagePo(page);

      await supportPage.goTo();
      await supportPage.waitForPage();

      const link = supportPage.supportLinks().nth(4);

      await expect(link).toHaveAttribute('href', expect.stringContaining('getting-started/overview'));
    });

    test(
      'can click on SUSE Application Collection link',
      { tag: ['@jenkins', '@prime', '@scc'] },
      async ({ page, login, rancherApi }) => {
        const version = await rancherApi.getRancherVersion();

        test.skip(version.RancherPrime !== 'true', 'Requires a Prime environment');
        await login();

        const supportPage = new SupportPagePo(page);

        await supportPage.goTo();
        await supportPage.waitForPage();

        const link = supportPage.supportLinks().nth(5);

        await expect(link).toHaveAttribute('href', expect.stringContaining('apps.rancher.io'));
      },
    );
  });
});
