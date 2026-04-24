import { test, expect } from '@/support/fixtures';
import { HorizontalPodAutoscalersPagePo } from '@/e2e/po/pages/explorer/horizontal-pod-autoscalers.po';
import {
  horizontalpodautoscalerGetResponseEmpty,
  horizontalpodautoscalerGetResponseSmallSet,
} from '@/e2e/blueprints/explorer/workloads/service-discovery/horizontal-pod-autoscalers-get';

test.describe('HorizontalPodAutoscalers', { tag: ['@explorer', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@noVai'] }, () => {
    test('validate HorizontalPodAutoscalers table in empty state', async ({ page, login }) => {
      await login();

      await page.route('**/v1/autoscaling.horizontalpodautoscalers?*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(horizontalpodautoscalerGetResponseEmpty),
        });
      });

      const hpaPage = new HorizontalPodAutoscalersPagePo(page);

      await hpaPage.goTo();
      await hpaPage.waitForPage();

      const expectedHeaders = [
        'State',
        'Name',
        'Namespace',
        'Workload',
        'Minimum Replicas',
        'Maximum Replicas',
        'Current Replicas',
        'Age',
      ];
      const sortableTable = hpaPage.list().resourceTable().sortableTable();

      await expect(sortableTable.self()).toBeVisible();
      await sortableTable.groupByButtons(0).click();
      await expect(sortableTable.tableHeaderRow()).toBeVisible();
      const headers = await sortableTable.headerNames();

      expect(headers).toEqual(expectedHeaders);
      await sortableTable.checkRowCount(true, 1);
    });

    test('flat list: validate HorizontalPodAutoscalers table', async ({ page, login }) => {
      await login();

      await page.route('**/v1/autoscaling.horizontalpodautoscalers?*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(horizontalpodautoscalerGetResponseSmallSet),
        });
      });

      const hpaPage = new HorizontalPodAutoscalersPagePo(page);

      await hpaPage.goTo();
      await hpaPage.waitForPage();

      const expectedHeaders = [
        'State',
        'Name',
        'Namespace',
        'Workload',
        'Minimum Replicas',
        'Maximum Replicas',
        'Current Replicas',
        'Age',
      ];
      const sortableTable = hpaPage.list().resourceTable().sortableTable();

      await expect(sortableTable.self()).toBeVisible();
      await sortableTable.checkLoadingIndicatorNotVisible();
      await sortableTable.groupByButtons(0).click();
      await expect(sortableTable.tableHeaderRow()).toBeVisible();
      const headers = await sortableTable.headerNames();

      expect(headers).toEqual(expectedHeaders);
      await sortableTable.noRowsShouldNotExist();
      await sortableTable.checkRowCount(false, 1);
    });

    test('group by namespace: validate HorizontalPodAutoscalers table', async ({ page, login }) => {
      await login();

      await page.route('**/v1/autoscaling.horizontalpodautoscalers?*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(horizontalpodautoscalerGetResponseSmallSet),
        });
      });

      const hpaPage = new HorizontalPodAutoscalersPagePo(page);

      await hpaPage.goTo();
      await hpaPage.waitForPage();

      const sortableTable = hpaPage.list().resourceTable().sortableTable();

      await sortableTable.groupByButtons(1).click();

      const expectedHeaders = [
        'State',
        'Name',
        'Workload',
        'Minimum Replicas',
        'Maximum Replicas',
        'Current Replicas',
        'Age',
      ];

      await expect(sortableTable.self()).toBeVisible();
      await sortableTable.checkLoadingIndicatorNotVisible();
      await expect(sortableTable.tableHeaderRow()).toBeVisible();
      const headers = await sortableTable.headerNames();

      expect(headers).toEqual(expectedHeaders);
      await sortableTable.noRowsShouldNotExist();

      const groupRow = sortableTable.groupElementWithName('Namespace: cattle-system');

      await expect(groupRow).toBeVisible();
      await sortableTable.checkRowCount(false, 1);
    });
  });
});
