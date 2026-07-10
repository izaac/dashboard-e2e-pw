import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';

test.describe('Home Page Support Links', { tag: ['@generic', '@adminUser', '@standardUser'] }, () => {
  test('can click on Docs link', async ({ page, login, rancherApi }) => {
    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();
    await homePage.waitForPage();

    await expect(homePage.supportLinks().first()).toBeVisible();
    const count = await homePage.supportLinks().count();

    expect(count).toBeGreaterThanOrEqual(6);

    const link = homePage.supportLinks().nth(0);
    const version = await rancherApi.getRancherVersion();
    const expectedUrl =
      version.RancherPrime === 'true'
        ? 'documentation.suse.com/cloudnative/rancher-manager'
        : 'ranchermanager.docs.rancher.com';

    await expect(link).toHaveAttribute('href', expect.stringContaining(expectedUrl));
  });

  test('can click on Forums link', async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();
    await homePage.waitForPage();

    const link = homePage.supportLinks().nth(1);

    await expect(link).toHaveAttribute('href', expect.stringContaining('forums.suse.com'));
  });

  test('can click on Slack link', async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();
    await homePage.waitForPage();

    const link = homePage.supportLinks().nth(2);

    await expect(link).toHaveAttribute('href', expect.stringContaining('slack.rancher.io'));
  });

  test('can click on File an Issue link', async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();
    await homePage.waitForPage();

    const link = homePage.supportLinks().nth(3);

    await expect(link).toHaveAttribute('href', expect.stringContaining('github.com'));
  });

  test('can click on Get Started link', async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();
    await homePage.waitForPage();

    const link = homePage.supportLinks().nth(4);

    await expect(link).toHaveAttribute('href', expect.stringContaining('getting-started/overview'));
  });

  test('can click on Rancher Prime link', { tag: ['@noPrime'] }, async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();
    await homePage.waitForPage();

    await homePage.clickSupportLink(5, true);
    await expect(page).toHaveURL(/suse\.com\/products\/rancher/);
  });

  test(
    'can click on SUSE Application Collection link',
    { tag: ['@jenkins', '@prime', '@scc'] },
    async ({ page, login }) => {
      await login();

      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await homePage.waitForPage();

      const link = homePage.supportLinks().nth(5);

      await expect(link).toHaveAttribute('href', expect.stringContaining('apps.rancher.io'));
    },
  );
});
