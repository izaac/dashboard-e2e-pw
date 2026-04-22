import { test, expect } from '@/support/fixtures';
import NotFoundPagePo from '@/e2e/po/pages/not-found-page.po';
import HomePagePo from '@/e2e/po/pages/home.po';
import { ChartsPage } from '@/e2e/po/pages/explorer/charts/charts.po';
import ChartRepositoriesPagePo from '@/e2e/po/pages/chart-repositories.po';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import PagePo from '@/e2e/po/pages/page.po';

test.describe('Not found page display', { tag: ['@generic', '@adminUser', '@standardUser'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('Will show a 404 if we do not have a valid Product id on the route path', async ({ page }) => {
    const notFound = new NotFoundPagePo(page, '/c/_/bogus-product-id');

    await notFound.goTo();
    await notFound.waitForPage();

    await expect(notFound.errorTitle()).toContainText('Error');
    await expect(notFound.errorMessage()).toContainText('Product bogus-product-id not found');
  });

  test('Will show a 404 if we do not have a valid Resource type on the route path', async ({ page }) => {
    const notFound = new NotFoundPagePo(page, '/c/_/manager/bogus-resource-type');

    await notFound.goTo();
    await notFound.waitForPage();

    await expect(notFound.errorTitle()).toContainText('Error');
    await expect(notFound.errorMessage()).toContainText('Resource type bogus-resource-type not found');
  });

  test('Will show a 404 if we do not have a valid Resource id on the route path', async ({ page }) => {
    const notFound = new NotFoundPagePo(
      page,
      '/c/_/manager/provisioning.cattle.io.cluster/fleet-default/bogus-resource-id',
    );

    await notFound.goTo();
    await notFound.waitForPage();

    await expect(notFound.errorTitle()).toContainText('Error');
    await expect(notFound.errorMessage()).toContainText(
      'Resource provisioning.cattle.io.cluster with id fleet-default/bogus-resource-id not found, unable to display resource details',
    );
  });

  test('Will show a 404 if we do not have a valid product + resource + resource id', async ({ page }) => {
    const notFound = new NotFoundPagePo(page, '/c/_/bogus-product-id/bogus-resource/bogus-resource-id');

    await notFound.goTo();
    await notFound.waitForPage();

    await expect(notFound.errorTitle()).toContainText('Error');
    await expect(notFound.errorMessage()).toContainText('Product bogus-product-id not found');
  });

  test('Will not show a 404 if we have a valid product + resource', async ({ page }) => {
    const notFound = new NotFoundPagePo(page, '/c/_/manager/provisioning.cattle.io.cluster');

    await notFound.goTo();
    await notFound.waitForPage();
    await expect(notFound.errorTitle()).not.toBeAttached();
  });

  test('Will not show a 404 for a valid type from the Norman API', async ({ page }) => {
    const notFound = new NotFoundPagePo(page, '/c/_/manager/cloudCredential/create');

    await notFound.goTo();
    await notFound.waitForPage();
    await expect(notFound.errorTitle()).not.toBeAttached();
  });

  test('Will not show a 404 for a valid type that does not have a real schema', async ({ page }) => {
    const notFound = new NotFoundPagePo(page, '/c/local/apps/charts');

    await notFound.goTo();
    await notFound.waitForPage();
    await expect(notFound.errorTitle()).not.toBeAttached();
  });

  test('Will not show a 404 if we have a valid product + resource and we nav to page', async ({ page }) => {
    const pagePo = new PagePo(page, '');
    const homePage = new HomePagePo(page);
    const notFoundPage = new NotFoundPagePo(page, '');
    const chartsPage = new ChartsPage(page);
    const reposPage = new ChartRepositoriesPagePo(page, 'local', 'apps');
    const clustersPage = new ClusterManagerListPagePo(page, '_');

    await homePage.goTo();

    await pagePo.navToClusterMenuEntry('local');

    await pagePo.navToSideMenuGroupByLabel('Apps');
    await chartsPage.waitForPage();
    await expect(notFoundPage.errorTitle()).not.toBeAttached();

    // 2.13: Repositories may not exist under Apps side-nav — navigate directly
    await reposPage.goTo();
    await expect(notFoundPage.errorTitle()).not.toBeAttached();

    await pagePo.navToMenuEntry('Cluster Management');
    await clustersPage.waitForPage();
    await expect(notFoundPage.errorTitle()).not.toBeAttached();
  });
});
