import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';
import AboutPagePo from '@/e2e/po/pages/about.po';
import DiagnosticsPagePo from '@/e2e/po/pages/diagnostics.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';

test.describe('About Page', { tag: ['@generic', '@adminUser', '@standardUser'] }, () => {
  // eslint-disable-next-line playwright/expect-expect -- assertion via waitForPage()
  test('can navigate to About page', async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);
    const aboutPage = new AboutPagePo(page);
    const burgerMenu = new BurgerMenuPo(page);

    await homePage.goTo();
    await homePage.waitForPage();

    await burgerMenu.about().click();
    await aboutPage.waitForPage();
  });

  test('no Prime info when community', { tag: ['@noPrime'] }, async ({ page, login }) => {
    await login();

    const aboutPage = new AboutPagePo(page);

    await aboutPage.goTo();
    await aboutPage.waitForPage();

    await expect(aboutPage.rancherPrimeInfo()).not.toBeAttached();
  });

  // eslint-disable-next-line playwright/expect-expect -- assertion via waitForPage()
  test('can navigate to Diagnostics page', async ({ page, login }) => {
    await login();

    const aboutPage = new AboutPagePo(page);
    const diagnosticsPage = new DiagnosticsPagePo(page);

    await aboutPage.goTo();
    await aboutPage.waitForPage();

    await aboutPage.diagnosticsBtn().click();
    await diagnosticsPage.waitForPage();
  });

  test('can View release notes', async ({ page, login, isPrime }) => {
    await login();

    const aboutPage = new AboutPagePo(page);

    await aboutPage.goTo();
    await aboutPage.waitForPage();

    const link = aboutPage.versionLink('View release notes');

    // Dev builds (head/rc/alpha) point to generic "latest" pages;
    // stable releases include the exact version in the URL.
    // We assert the domain only — both patterns are valid.
    const expectedDomain = isPrime ? 'documentation.suse.com' : 'github.com/rancher/rancher/releases';

    await expect(link).toHaveAttribute('href', expect.stringContaining(expectedDomain));
  });

  test.describe('Versions', () => {
    test('can see rancher version', async ({ page, login, rancherApi }) => {
      await login();

      const aboutPage = new AboutPagePo(page);

      await aboutPage.goTo();
      await aboutPage.waitForPage();

      const resp = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'server-version');
      const rancherVersion = resp.body.value;

      await expect(aboutPage.versionText(rancherVersion).first()).toBeVisible();
    });

    test('can navigate to /rancher/rancher', async ({ page, login }) => {
      await login();

      const aboutPage = new AboutPagePo(page);

      await aboutPage.goTo();
      await aboutPage.waitForPage();

      await expect(aboutPage.versionLink('Rancher')).toHaveAttribute(
        'href',
        expect.stringContaining('github.com/rancher/rancher'),
      );
    });

    test('can navigate to /rancher/dashboard', async ({ page, login }) => {
      await login();

      const aboutPage = new AboutPagePo(page);

      await aboutPage.goTo();
      await aboutPage.waitForPage();

      await expect(aboutPage.versionLink('Dashboard')).toHaveAttribute(
        'href',
        expect.stringContaining('github.com/rancher/dashboard'),
      );
    });

    test('can navigate to /rancher/helm', async ({ page, login }) => {
      await login();

      const aboutPage = new AboutPagePo(page);

      await aboutPage.goTo();
      await aboutPage.waitForPage();

      await expect(aboutPage.versionLink('Helm')).toHaveAttribute(
        'href',
        expect.stringContaining('github.com/rancher/helm'),
      );
    });

    test('can navigate to /rancher/machine', async ({ page, login }) => {
      await login();

      const aboutPage = new AboutPagePo(page);

      await aboutPage.goTo();
      await aboutPage.waitForPage();

      await expect(aboutPage.versionLink('Machine')).toHaveAttribute(
        'href',
        expect.stringContaining('github.com/rancher/machine'),
      );
    });
  });

  test.describe('CLI Downloads', () => {
    test('can download macOS CLI', async ({ page, login }) => {
      await login();

      const aboutPage = new AboutPagePo(page);

      await aboutPage.goTo();
      await aboutPage.waitForPage();

      const href = await aboutPage.getLinkDestination('rancher-darwin');

      expect(href).toContain('releases.rancher.com/cli2');

      await aboutPage.setDownloadAttribute('rancher-darwin');

      const downloadPromise = page.waitForResponse(
        (resp) => resp.url().includes('releases.rancher.com/cli2') && resp.url().includes('darwin'),
      );

      await aboutPage.getCliDownloadLinkByLabel('rancher-darwin').click();
      const downloadResp = await downloadPromise;

      expect(downloadResp.status()).toBe(200);
    });

    test('can download Linux CLI', async ({ page, login }) => {
      await login();

      const aboutPage = new AboutPagePo(page);

      await aboutPage.goTo();
      await aboutPage.waitForPage();

      const href = await aboutPage.getLinkDestination('rancher-linux');

      expect(href).toContain('releases.rancher.com/cli2');

      await aboutPage.setDownloadAttribute('rancher-linux');

      const downloadPromise = page.waitForResponse(
        (resp) => resp.url().includes('releases.rancher.com/cli2') && resp.url().includes('linux'),
      );

      await aboutPage.getCliDownloadLinkByLabel('rancher-linux').click();
      const downloadResp = await downloadPromise;

      expect(downloadResp.status()).toBe(200);
    });

    test('can download Windows CLI', async ({ page, login }) => {
      await login();

      const aboutPage = new AboutPagePo(page);

      await aboutPage.goTo();
      await aboutPage.waitForPage();

      const href = await aboutPage.getLinkDestination('rancher-windows');

      expect(href).toContain('releases.rancher.com/cli2');

      await aboutPage.setDownloadAttribute('rancher-windows');

      const downloadPromise = page.waitForResponse(
        (resp) => resp.url().includes('releases.rancher.com/cli2') && resp.url().includes('windows'),
      );

      await aboutPage.getCliDownloadLinkByLabel('rancher-windows').click();
      const downloadResp = await downloadPromise;

      expect(downloadResp.status()).toBe(200);
    });
  });

  test.describe('Rancher Prime', { tag: ['@prime'] }, () => {
    test('should show prime panel on about page', async ({ page, login }) => {
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

      await login();

      const homePage = new HomePagePo(page);
      const aboutPage = new AboutPagePo(page);
      const burgerMenu = new BurgerMenuPo(page);

      await homePage.goTo();
      await homePage.waitForPage();

      await burgerMenu.about().click();
      await aboutPage.waitForPage();

      await expect(aboutPage.rancherPrimeInfo()).toBeAttached();
    });
  });
});
