import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';
import { HomeLinksPagePo } from '@/e2e/po/pages/global-settings/home-links.po';

const APP_CO_LINK = 'https://apps.rancher.io/';
const APP_CO_LABEL = 'SUSE Application Collection';

test.describe('SUSE Application page and link', { tag: ['@generic', '@adminUser'] }, () => {
  test.describe.configure({ mode: 'serial' });
  test.describe('link can be hidden via settings', () => {
    test('should allow app co link to be hidden', async ({ page, login, rancherApi }) => {
      await login();

      // Mock prime version so the SUSE Application Collection link appears
      await page.route('**/rancherversion', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ Version: '9bf6631da', GitCommit: '9bf6631da', RancherPrime: 'true' }),
        }),
      );

      // Reset custom links setting
      const setting = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-custom-links');

      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-custom-links', {
        ...setting.body,
        value: '{}',
      });

      try {
        const homeLinksPage = new HomeLinksPagePo(page);

        await homeLinksPage.goTo();
        await homeLinksPage.waitForPage();

        const linkCount = await homeLinksPage.defaultLinkNames().count();

        // The SUSE Application Collection link only appears in prime builds
        // If the link count is 5, the mock didn't take effect (non-prime environment)
        test.skip(linkCount < 6, 'SUSE Application Collection link not present — requires Rancher Prime');

        await expect(homeLinksPage.defaultLinkName(5)).toContainText(APP_CO_LABEL);
        await expect(homeLinksPage.defaultLinkTarget(5)).toContainText(APP_CO_LINK);

        const checkbox = homeLinksPage.defaultLinkCheckbox(5);

        await expect(checkbox.self()).toBeAttached();
        await expect(checkbox.self()).toBeVisible();
        await checkbox.set();

        await homeLinksPage.applyButton().click();

        const homePage = new HomePagePo(page);

        await homePage.goTo();
        await homePage.waitForPage();

        await expect(homePage.supportLinks()).toHaveCount(5);
      } finally {
        const freshSetting = await rancherApi.getRancherResource(
          'v1',
          'management.cattle.io.settings',
          'ui-custom-links',
        );

        await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-custom-links', {
          ...freshSetting.body,
          value: '{}',
        });
      }
    });

    test('should migrate v1 custom links setting', async ({ page, login, rancherApi }) => {
      await login();

      await page.route('**/rancherversion', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ Version: '9bf6631da', GitCommit: '9bf6631da', RancherPrime: 'true' }),
        }),
      );

      const setting = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'ui-custom-links');
      const v1Value = {
        version: 'v1',
        defaults: ['docs', 'forums', 'slack', 'issues', 'getStarted', 'commercialSupport'],
        custom: [],
      };

      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-custom-links', {
        ...setting.body,
        value: JSON.stringify(v1Value),
      });

      try {
        const homeLinksPage = new HomeLinksPagePo(page);

        await homeLinksPage.goTo();
        await homeLinksPage.waitForPage();

        const linkCount = await homeLinksPage.defaultLinkNames().count();

        test.skip(linkCount < 6, 'SUSE Application Collection link not present — requires Rancher Prime');

        await expect(homeLinksPage.defaultLinkName(5)).toContainText(APP_CO_LABEL);
        await expect(homeLinksPage.defaultLinkTarget(5)).toContainText(APP_CO_LINK);

        const checkbox = homeLinksPage.defaultLinkCheckbox(5);

        await expect(checkbox.self()).toBeAttached();
        await expect(checkbox.self()).toBeVisible();
        await checkbox.set();

        await homeLinksPage.applyButton().click();

        const homePage = new HomePagePo(page);

        await homePage.goTo();
        await homePage.waitForPage();

        await expect(homePage.supportLinks()).toHaveCount(5);
      } finally {
        const freshSetting = await rancherApi.getRancherResource(
          'v1',
          'management.cattle.io.settings',
          'ui-custom-links',
        );

        await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'ui-custom-links', {
          ...freshSetting.body,
          value: '{}',
        });
      }
    });
  });

  test.describe('home page links (prime)', { tag: ['@prime', '@generic', '@adminUser', '@standardUser'] }, () => {
    test('can click on Application Collection link', async ({ page, login }) => {
      await login();

      await page.route('**/rancherversion', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ Version: '9bf6631da', GitCommit: '9bf6631da', RancherPrime: 'true' }),
        }),
      );

      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await homePage.waitForPage();

      const linkCount = await homePage.supportLinks().count();

      test.skip(linkCount < 6, 'SUSE Application Collection link not present — requires Rancher Prime');

      await expect(homePage.supportLinks().nth(5)).toContainText(APP_CO_LABEL);
    });
  });
});
