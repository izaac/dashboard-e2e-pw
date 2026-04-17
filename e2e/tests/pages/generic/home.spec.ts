import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';

test.describe('Home Page', () => {
  test(
    'Confirm correct number of settings requests made',
    { tag: ['@generic', '@adminUser', '@standardUser'] },
    async ({ page, login }) => {
      await login();

      const homePage = new HomePagePo(page);
      let settingsRequestCount = 0;

      page.on('request', (req) => {
        if (req.url().includes('/v1/management.cattle.io.settings?exclude=metadata.managedFields')) {
          settingsRequestCount++;
        }
      });

      await homePage.goTo();
      await homePage.waitForPage();

      // Wait a bit for any additional requests that might fire
      await page.waitForTimeout(1500);

      // Should only have one settings request
      expect(settingsRequestCount).toBe(1);
    },
  );

  test.describe('List', { tag: ['@generic', '@adminUser'] }, () => {
    test('Can see that cluster details match those in Cluster Management page', async ({ page, login }) => {
      await login();

      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await homePage.waitForPage();

      const listContainer = homePage.list();

      // Verify 'local' cluster is visible with version info
      const localRow = listContainer.locator('tr').filter({ hasText: 'local' });

      await expect(localRow).toBeVisible();

      // Version column should not show dash (meaning data loaded)
      const versionCell = localRow.locator('td').nth(3);

      await expect(versionCell).not.toHaveText('—');
    });

    test('Can filter rows in the cluster list', async ({ page, login }) => {
      await login();

      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await homePage.waitForPage();

      const filterInput = homePage.list().locator('[data-testid="search-box-filter-row"] input');

      // Filter with non-matching text
      await filterInput.fill('random text');
      await expect(homePage.list().getByText('There are no rows which match your search query.')).toBeVisible();

      // Filter with matching text
      await filterInput.fill('local');
      await expect(homePage.list().locator('tr').filter({ hasText: 'local' })).toBeVisible();
    });

    test('Should show cluster description information in the cluster list', async ({ page, login }) => {
      await login();

      const longClusterDescription = 'this-is-some-really-really-really-really-really-really-long-description';

      // Intercept cluster list and inject a description on the local cluster
      await page.route('**/v1/provisioning.cattle.io.clusters?*', async (route) => {
        const response = await route.fetch();
        const json = await response.json();

        const localIndex = json.data.findIndex((item: any) => item.id.includes('/local'));

        if (localIndex >= 0) {
          json.data[localIndex].metadata.annotations['field.cattle.io/description'] = longClusterDescription;
        }

        await route.fulfill({ json });
      });

      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await homePage.waitForPage();

      await expect(
        homePage.list().locator('.cluster-description').filter({ hasText: longClusterDescription }),
      ).toBeVisible();
    });

    test('check table headers are visible', { tag: ['@noVai'] }, async ({ page, login }) => {
      await login();

      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await homePage.waitForPage();

      const expectedHeaders = [
        'State',
        'Name',
        'Provider Distro',
        'Kubernetes Version Architecture',
        'CPU',
        'Memory',
        'Pods',
      ];

      const headers = homePage.list().locator('.table-header-container .content');
      const count = await headers.count();

      for (let i = 0; i < count && i < expectedHeaders.length; i++) {
        const text = (await headers.nth(i).innerText()).trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');

        expect(text).toBe(expectedHeaders[i]);
      }
    });
  });

  test.describe('Support Links', { tag: ['@generic', '@adminUser', '@standardUser'] }, () => {
    test('Docs link has correct href', async ({ page, login, rancherApi }) => {
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

    test('Forums link has correct href', async ({ page, login }) => {
      await login();

      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await homePage.waitForPage();

      const link = homePage.supportLinks().nth(1);

      await expect(link).toHaveAttribute('href', expect.stringContaining('forums.suse.com'));
    });

    test('Slack link has correct href', async ({ page, login }) => {
      await login();

      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await homePage.waitForPage();

      const link = homePage.supportLinks().nth(2);

      await expect(link).toHaveAttribute('href', expect.stringContaining('slack.rancher.io'));
    });

    test('File an Issue link has correct href', async ({ page, login }) => {
      await login();

      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await homePage.waitForPage();

      const link = homePage.supportLinks().nth(3);

      await expect(link).toHaveAttribute('href', expect.stringContaining('github.com'));
    });

    test('Get Started link has correct href', async ({ page, login }) => {
      await login();

      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await homePage.waitForPage();

      const link = homePage.supportLinks().nth(4);

      await expect(link).toHaveAttribute('href', expect.stringContaining('getting-started/overview'));
    });

    test('Commercial Support link navigates to support page', { tag: ['@noPrime'] }, async ({ page, login }) => {
      await login();

      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await homePage.waitForPage();

      await homePage.clickSupportLink(5);
      await expect(page).toHaveURL(/\/support/);
    });

    test(
      'SUSE Application Collection link has correct href',
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

  test.describe('Home Page Features', { tag: ['@generic', '@adminUser', '@standardUser'] }, () => {
    test('has notification for release notes', async ({ page, login, rancherApi }) => {
      // Reset the whatsnew preference so notification appears
      await rancherApi.setUserPreference({ 'read-whatsnew': '' });

      await login();

      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await homePage.waitForPage();

      const nc = homePage.notificationsCenter();

      // Open the notification centre
      await nc.toggle();
      await nc.checkOpen();
      await nc.checkExists();
      await nc.checkVisible();
      await nc.checkHasUnread();

      // Get the release notes notification
      const item = nc.getNotificationByName('release-notes');

      await item.checkExists();

      // Mark all as read
      const markReadPromise = page.waitForResponse(
        (resp) => resp.url().includes('v1/userpreferences') && resp.request().method() === 'PUT',
      );

      await nc.markAllRead();
      await markReadPromise;

      await nc.checkAllRead();

      // Close
      await nc.toggle();
      await nc.checkClosed();

      // Open again
      await nc.toggle();
      await nc.checkOpen();
      await nc.checkExists();
      await nc.checkVisible();
      await nc.checkAllRead();

      // Verify notification title and toggle read state
      const item2 = nc.getNotificationByName('release-notes');

      await expect(item2.title()).toContainText('Welcome to Rancher v');
      await expect(item2.primaryActionButton()).toBeAttached();

      await item2.checkRead();
      await item2.toggleRead();
      await item2.checkUnread();
      await nc.checkHasUnread();
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
});
