import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';

test.describe('Home Page', { tag: ['@generic', '@adminUser', '@standardUser'] }, () => {
  let savedWhatsnew: string | undefined;
  let savedHomePageCards: string | undefined;

  test.beforeEach(async ({ rancherApi }) => {
    const result = await rancherApi.getRancherResource('v1', 'userpreferences');
    const data = result.body.data[0]?.data || {};

    savedWhatsnew = data['read-whatsnew'];
    savedHomePageCards = data['home-page-cards'];
  });

  test.afterEach(async ({ rancherApi }) => {
    const restore: Record<string, any> = {};

    if (savedWhatsnew !== undefined) {
      restore['read-whatsnew'] = savedWhatsnew;
    }
    if (savedHomePageCards !== undefined) {
      restore['home-page-cards'] = savedHomePageCards;
    }
    if (Object.keys(restore).length > 0) {
      await rancherApi.setUserPreference(restore);
    }
  });

  test('has notification for release notes', async ({ page, login, rancherApi, isPrime }) => {
    await rancherApi.setUserPreference({ 'read-whatsnew': '' });

    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();
    await homePage.waitForPage();

    const nc = homePage.notificationsCenter();

    // Open the notification centre
    await nc.toggle();
    await expect(nc.expandedState()).toBeAttached();
    await expect(nc.self()).toBeAttached();
    await expect(nc.self()).toBeVisible();
    await expect(nc.unreadIndicator()).toBeAttached();

    // Get the release notes notification
    const item = nc.getNotificationByName('release-notes');

    await expect(item.self()).toBeAttached();

    // Mark all as read
    const markReadPromise = page.waitForResponse(
      (resp) => resp.url().includes('v1/userpreferences') && resp.request().method() === 'PUT',
    );

    await nc.markAllRead();
    await markReadPromise;

    await expect(nc.unreadIndicator()).not.toBeAttached();

    // Close
    await nc.toggle();
    await expect(nc.collapsedState()).toBeAttached();

    // Open again
    await nc.toggle();
    await expect(nc.expandedState()).toBeAttached();
    await expect(nc.self()).toBeAttached();
    await expect(nc.self()).toBeVisible();

    // Prime ships a persistent "Rancher Prime Registration" notification that
    // re-flags itself unread on reopen, so the global unread indicator no longer
    // tracks the release-notes item alone. Assert the release-notes item's own
    // read state below instead of the global indicator on Prime.
    if (!isPrime) {
      // eslint-disable-next-line playwright/no-conditional-expect -- global unread indicator is edition-specific; Prime asserts item read state instead
      await expect(nc.unreadIndicator()).not.toBeAttached();
    }

    // Verify notification title and toggle read state
    const item2 = nc.getNotificationByName('release-notes');

    await expect(item2.title()).toContainText('Welcome to Rancher v');
    await expect(item2.primaryActionButton()).toBeAttached();

    // Notification is read (was marked read above) — unread icon should not be present
    await expect(item2.readIcon()).not.toBeAttached();
    await item2.toggleRead();
    // After toggling back to unread — unread icon should appear
    await expect(item2.readIcon()).toBeAttached();
    await expect(nc.unreadIndicator()).toBeAttached();
  });

  test('Can navigate to release notes page for latest Rancher version', async ({ page, login, rancherApi }) => {
    // Reset whatsnew pref so the release-notes notification appears
    await rancherApi.setUserPreference({ 'read-whatsnew': '' });

    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();
    await homePage.waitForPage();

    const nc = homePage.notificationsCenter();

    await nc.toggle();
    await expect(nc.expandedState()).toBeAttached();
    await expect(nc.self()).toBeAttached();
    await expect(nc.self()).toBeVisible();

    const item = nc.getNotificationByName('release-notes');

    await expect(item.self()).toBeAttached();

    const version = await rancherApi.getRancherVersion();

    // Stub window.open so clicking the button doesn't actually open a tab
    await homePage.stubWindowOpen();

    await item.primaryActionButton().click();

    // Retrieve the captured window.open call and assert the URL
    const openCalls = await homePage.getCapturedOpenCalls();

    expect(openCalls.length).toBeGreaterThanOrEqual(1);

    const [url, target] = openCalls[0];

    if (version.RancherPrime === 'true') {
      // eslint-disable-next-line playwright/no-conditional-expect -- URL differs by Rancher edition
      expect(url).toContain('documentation.suse.com/cloudnative/rancher-manager');
    } else {
      // eslint-disable-next-line playwright/no-conditional-expect -- URL differs by Rancher edition
      expect(url).toContain('github.com/rancher/rancher/releases');
    }
    expect(target).toBe('_blank');
  });

  test('Can toggle banner graphic', async ({ page, login, rancherApi }) => {
    // Reset home page cards pref
    await rancherApi.setUserPreference({ 'home-page-cards': '{}' });

    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();
    await homePage.waitForPage();

    // Banner graphic should be visible
    await expect(homePage.bannerGraphic()).toBeVisible();

    // Helper: open page actions menu and click "Show/Hide Banner", waiting for the preference PUT
    const clickBannerToggle = async () => {
      await homePage.pageActionsButton().click();

      const menuItem = homePage.pageActionsMenuItem('Show/Hide Banner');

      await expect(menuItem).toBeVisible();

      const prefPromise = page.waitForResponse(
        (resp) => resp.url().includes('v1/userpreferences') && resp.request().method() === 'PUT',
      );

      await menuItem.click();
      await prefPromise;
    };

    // Hide the banner
    await clickBannerToggle();
    await expect(homePage.bannerGraphic()).not.toBeAttached();

    // Reload to get a clean DOM state before showing the banner again
    await homePage.goTo();
    await homePage.waitForPage();
    await expect(homePage.bannerGraphic()).not.toBeAttached();

    // Show the banner again
    await clickBannerToggle();
    await expect(homePage.bannerGraphic()).toBeAttached();
  });

  // eslint-disable-next-line playwright/expect-expect -- assertion via waitForPage()
  test('Can navigate to Home page via burger menu', async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);

    await homePage.navTo();
    await homePage.waitForPage();
  });

  test('Can use the Manage button', async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();
    await homePage.waitForPage();

    await homePage.manageButton().click();
    await expect(page).toHaveURL(/\/c\/_\/manager\/provisioning\.cattle\.io\.cluster/);
  });

  test('Can use the Import Existing button', async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();
    await homePage.waitForPage();

    await homePage.importExistingButton().click();
    await expect(page).toHaveURL(/mode=import/);
  });

  test('Can use the Create button', async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();
    await homePage.waitForPage();

    await homePage.createButton().click();
    await expect(page).toHaveURL(/\/c\/_\/manager\/provisioning\.cattle\.io\.cluster\/create/);
  });
});
