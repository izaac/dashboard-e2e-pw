import { test, expect } from '@/support/fixtures';
import { ChartPage } from '@/e2e/po/pages/explorer/charts/chart.po';
import RadioGroupInputPo from '@/e2e/po/components/radio-group-input.po';
import { exampleStorageClass, defaultStorageClass } from '@/e2e/blueprints/charts/rancher-backup-chart';
import LabeledSelectPo from '@/e2e/po/components/labeled-select.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import HomePagePo from '@/e2e/po/pages/home.po';
import { InstallChartPage } from '@/e2e/po/pages/explorer/charts/install-charts.po';

const STORAGE_CLASS_RESOURCE = 'storage.k8s.io.storageclasses';

test.describe('Charts', { tag: ['@charts', '@adminUser'] }, () => {
  test.describe('Rancher Backups', () => {
    test.beforeEach(async ({ login }) => {
      await login();
    });

    test.describe('Rancher Backups storage class config', () => {
      test.afterEach(async ({ rancherApi }) => {
        // Clean up storage classes regardless of test outcome
        await rancherApi.deleteRancherResource('v1', STORAGE_CLASS_RESOURCE, 'test-default-storage-class', false);
        await rancherApi.deleteRancherResource('v1', STORAGE_CLASS_RESOURCE, 'test-no-annotations', false);
      });

      test('Should auto-select default storage class', async ({ page, rancherApi }) => {
        // Clean up first in case resources exist from a previous failed run
        await rancherApi.deleteRancherResource('v1', STORAGE_CLASS_RESOURCE, 'test-default-storage-class', false);
        await rancherApi.deleteRancherResource('v1', STORAGE_CLASS_RESOURCE, 'test-no-annotations', false);

        // Create storage classes
        await rancherApi.createRancherResource('v1', STORAGE_CLASS_RESOURCE, defaultStorageClass);
        await rancherApi.createRancherResource('v1', STORAGE_CLASS_RESOURCE, exampleStorageClass);

        const homePage = new HomePagePo(page);

        await homePage.goTo();

        // Set up response listeners before triggering navigation
        const storageClassesPromise = page.waitForResponse((resp) => resp.url().includes('/v1/storage.k8s.io.storageclasses?') && resp.status() === 200);
        const persistentVolumesPromise = page.waitForResponse((resp) => resp.url().includes('/v1/persistentvolumes?') && resp.status() === 200);

        const chartPage = new ChartPage(page);
        const installPage = new InstallChartPage(page);

        await chartPage.navTo('Rancher Backups');
        await chartPage.waitForPage('repo-type=cluster&repo=rancher-charts&chart=rancher-backup');

        await chartPage.goToInstall();
        await installPage.nextPage();

        await storageClassesPromise;
        await persistentVolumesPromise;

        await installPage.waitForPage('repo-type=cluster&repo=rancher-charts&chart=rancher-backup');

        // Scroll to bottom
        await page.locator('.main-layout > .outlet > .outer-container').evaluate(
          (el) => el.scrollTo(0, el.scrollHeight)
        );

        // Select 'Use an existing storage class' option
        const storageOptions = new RadioGroupInputPo(page, '[chart="[chart: cluster/rancher-charts/rancher-backup]"]');

        await storageOptions.checkExists();
        await storageOptions.set(2);

        // Scroll to bottom again after selection
        await page.locator('.main-layout > .outlet > .outer-container').evaluate(
          (el) => el.scrollTo(0, el.scrollHeight)
        );

        // Verify the drop-down exists and select default storage class
        const select = new LabeledSelectPo(page, '[data-testid="backup-chart-select-existing-storage-class"]');

        await select.checkExists();
        await select.toggle();
        await select.clickOptionWithLabel('test-default-storage-class');
        await select.checkOptionSelected('test-default-storage-class');

        // Verify that changing tabs doesn't reset the last selected storage class option
        await installPage.editYaml();
        const tabbedOptions = new TabbedPo(page);

        await installPage.editOptions(tabbedOptions, '[data-testid="button-group-child-0"]');

        await select.checkExists();
        await select.checkOptionSelected('test-default-storage-class');
      });
    });
  });
});
