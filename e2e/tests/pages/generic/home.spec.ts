import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';

test.describe('Home Page', () => {
  test.describe.configure({ mode: 'serial' });
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

      // Wait for settings request to complete
      await page.waitForResponse((resp) => resp.url().includes('/v1/management.cattle.io.settings'), {
        timeout: 2000,
      });

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

      const clusterName = 'local';
      const listContainer = homePage.list();

      // Verify 'local' cluster is visible with version info
      const localRow = listContainer.locator('tr').filter({ hasText: clusterName });

      await expect(localRow).toBeVisible();

      // Version column should not show dash (meaning data loaded)
      const versionCell = localRow.locator('td').nth(3);

      await expect(versionCell).not.toHaveText('—');

      // Extract cluster details from home page (state, name, version, provider)
      await expect(localRow.locator('td').nth(0)).not.toHaveText('');
      const homeState = (await localRow.locator('td').nth(0).innerText()).trim();

      await expect(localRow.locator('td').nth(1)).not.toHaveText('');
      const homeName = (await localRow.locator('td').nth(1).innerText()).trim();

      await expect(localRow.locator('td').nth(2)).not.toHaveText('');
      const homeProvider = (await localRow.locator('td').nth(2).innerText()).trim();

      await expect(localRow.locator('td').nth(3)).not.toHaveText('');
      const homeVersion = (await localRow.locator('td').nth(3).innerText()).trim();

      // Navigate to Cluster Management page and verify same details
      const provClusterList = new ClusterManagerListPagePo(page);

      await provClusterList.goTo();
      await provClusterList.waitForPage();

      const cmRow = provClusterList.list().rowWithName(clusterName);

      await expect(cmRow.column(1)).toContainText(homeState);
      await expect(cmRow.column(2)).toContainText(homeName);
      await expect(cmRow.column(3)).toContainText(homeVersion);
      await expect(cmRow.column(4)).toContainText(homeProvider);
    });

    test('Can filter rows in the cluster list', async ({ page, login }) => {
      await login();

      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await homePage.waitForPage();

      const filterInput = homePage.filterInput();

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

      await expect(homePage.clusterDescriptions().filter({ hasText: longClusterDescription })).toBeVisible();
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

      const headers = homePage.tableHeaders();
      const count = await headers.count();

      for (let i = 0; i < count && i < expectedHeaders.length; i++) {
        await expect(headers.nth(i)).not.toHaveText('');
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

    test('has notification for release notes', async ({ page, login, rancherApi }) => {
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

    test('Can navigate to release notes page for latest Rancher version', async ({ page, login, rancherApi }) => {
      // Reset whatsnew pref so the release-notes notification appears
      await rancherApi.setUserPreference({ 'read-whatsnew': '' });

      await login();

      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await homePage.waitForPage();

      const nc = homePage.notificationsCenter();

      await nc.toggle();
      await nc.checkOpen();
      await nc.checkExists();
      await nc.checkVisible();

      const item = nc.getNotificationByName('release-notes');

      await item.checkExists();

      const version = await rancherApi.getRancherVersion();

      // Stub window.open so clicking the button doesn't actually open a tab
      await homePage.stubWindowOpen();

      await item.primaryActionButton().click();

      // Retrieve the captured window.open call and assert the URL
      const openCalls = await homePage.getCapturedOpenCalls();

      expect(openCalls.length).toBeGreaterThanOrEqual(1);

      const [url, target] = openCalls[0];

      if (version.RancherPrime === 'true') {
        expect(url).toContain('documentation.suse.com/cloudnative/rancher-manager');
      } else {
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
