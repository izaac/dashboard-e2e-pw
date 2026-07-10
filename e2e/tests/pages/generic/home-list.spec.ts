import { test, expect } from '@/support/fixtures';
import HomePagePo from '@/e2e/po/pages/home.po';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import { ensureLightTheme, chromeMasks, visualSnapshot } from '@/support/utils/visual-snapshot';

test.describe('Home Page List', { tag: ['@generic', '@adminUser'] }, () => {
  test('Can see that cluster details match those in Cluster Management page', async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();
    await homePage.waitForPage();

    const clusterName = 'local';

    // Verify 'local' cluster is visible with version info
    const localRow = homePage.clusterRow(clusterName);

    await expect(localRow).toBeVisible();

    // Version column should not show dash (meaning data loaded)
    const versionCell = homePage.clusterRowCell(clusterName, 3);

    await expect(versionCell).not.toHaveText('—');

    // Extract cluster details from home page (state, name, version, provider)
    await expect(homePage.clusterRowCell(clusterName, 0)).not.toHaveText('');
    const homeState = (await homePage.clusterRowCell(clusterName, 0).innerText()).trim();

    await expect(homePage.clusterRowCell(clusterName, 1)).not.toHaveText('');
    const homeName = (await homePage.clusterRowCell(clusterName, 1).innerText()).trim();

    await expect(homePage.clusterRowCell(clusterName, 2)).not.toHaveText('');
    const homeProvider = (await homePage.clusterRowCell(clusterName, 2).innerText()).trim();

    await expect(homePage.clusterRowCell(clusterName, 3)).not.toHaveText('');
    const homeVersion = (await homePage.clusterRowCell(clusterName, 3).innerText()).trim();

    // Navigate to Cluster Management page and verify same details
    const provClusterList = new ClusterManagerListPagePo(page);

    await provClusterList.goTo();
    await provClusterList.waitForPage();

    const cmRow = provClusterList.list().rowWithName(clusterName);

    // Cluster Management list has a leading checkbox cell — home col N maps to column(N+1).
    await expect(cmRow.column(1)).toContainText(homeState);
    await expect(cmRow.column(2)).toContainText(homeName);
    await expect(cmRow.column(3)).toContainText(homeProvider);
    await expect(cmRow.column(4)).toContainText(homeVersion);
  });

  test('Can filter rows in the cluster list', async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);

    await homePage.goTo();
    await homePage.waitForPage();

    const filterInput = homePage.filterInput();

    // Filter with non-matching text
    await filterInput.fill('random text');
    await expect(homePage.noResultsMessage()).toBeVisible();

    // Filter with matching text
    await filterInput.fill('local');
    await expect(homePage.clusterRow('local')).toBeVisible();
  });

  test('Should show cluster description information in the cluster list', async ({ page, login }) => {
    await login();

    const longClusterDescription = 'this-is-some-really-really-really-really-really-really-long-description';

    // Inject a description annotation on the local mgmt cluster — the home
    // page table renders management.cattle.io.cluster rows, not provisioning.
    await page.route(/\/v1\/management\.cattle\.io\.clusters(\?|$)/, async (route) => {
      const response = await route.fetch();
      const json = await response.json();

      const localIndex = json.data.findIndex((item: any) => item.id === 'local');

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

    for (let i = 0; i < expectedHeaders.length; i++) {
      await expect(headers.nth(i)).toHaveText(expectedHeaders[i]);
    }
  });
});

test.describe('Visual snapshots', { tag: ['@visual', '@generic', '@adminUser'] }, () => {
  test('home page matches snapshot', async ({ page, login, rancherApi, isPrime }) => {
    await login();
    const restoreTheme = await ensureLightTheme(rancherApi);

    try {
      const homePage = new HomePagePo(page);

      await homePage.goTo();
      await homePage.waitForPage();
      // Wait for the masthead banner title — anchors that the home page
      // banner has actually mounted (vs. the dashboard shell spinner).
      await expect(homePage.title()).toBeVisible();

      // Empty-state guard: snapshot baseline expects only the local cluster row.
      // If a peer provisioning test left an orphan, fail loudly.
      // eslint-disable-next-line playwright/no-raw-locators -- chains a generic `tbody tr` selector for a row count; HomePagePo does not expose a row-count helper and adding one for a single visual-snapshot guard isn't worth the API surface
      await expect(homePage.list().locator('tbody tr')).toHaveCount(1);
      await expect(homePage.clusterRow('local')).toBeVisible();

      await expect(page).toHaveScreenshot(visualSnapshot(isPrime, 'home.png'), {
        fullPage: true,
        mask: chromeMasks(page),
      });
    } finally {
      await restoreTheme();
    }
  });
});
