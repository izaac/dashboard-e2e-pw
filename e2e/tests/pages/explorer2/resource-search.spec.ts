import { test, expect } from '@/support/fixtures';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import ResourceSearchDialog from '@/e2e/po/prompts/ResourceSearchDialog.po';
import { NamespaceFilterPo } from '@/e2e/po/components/namespace-filter.po';

test.describe('Cluster Dashboard', { tag: ['@explorer2', '@adminUser', '@standardUser'] }, () => {
  test.beforeEach(async ({ page, login }) => {
    await login();
    const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

    await clusterDashboard.goTo();
    await clusterDashboard.waitForPage();
  });

  test('can show resource search dialog', async ({ page }) => {
    const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

    await page.getByTestId('header-resource-search').click();

    const dialog = new ResourceSearchDialog(page);

    await dialog.checkExists();
    await dialog.checkVisible();

    await dialog.searchBox().fill('ConfigMap');

    await expect(dialog.results()).toHaveCount(1);
    await expect(dialog.results().first()).toHaveText('ConfigMaps');

    await page.keyboard.press('Escape');
    await dialog.waitForNoDialog();
  });

  test('can search by resource group', async ({ page }) => {
    const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

    await page.getByTestId('header-resource-search').click();

    const dialog = new ResourceSearchDialog(page);

    await dialog.checkExists();
    await dialog.checkVisible();

    await dialog.searchBox().fill('provisioning.cattle');

    await expect(dialog.results()).toHaveCount(1, { timeout: 10000 });
    await expect(dialog.results().first()).toHaveText('Clusters (clusters.provisioning.cattle.io)');

    await page.keyboard.press('Escape');
    await dialog.waitForNoDialog();
  });

  test('can show resource dialog when namespace chooser is open', async ({ page }) => {
    const namespacePicker = new NamespaceFilterPo(page);

    await namespacePicker.toggle();
    await namespacePicker.clickOptionByLabel('Only User Namespaces');
    await namespacePicker.isChecked('Only User Namespaces');

    const dialog = new ResourceSearchDialog(page);

    await dialog.open();
    await dialog.checkExists();
    await dialog.checkVisible();

    await dialog.searchBox().fill('ConfigMap');

    await expect(dialog.results()).toHaveCount(1);
    await expect(dialog.results().first()).toHaveText('ConfigMaps');

    await dialog.results().first().click();

    await expect(page).toHaveURL(/\/c\/local\/explorer\/configmap/);
    await dialog.checkNotExists();
  });
});
