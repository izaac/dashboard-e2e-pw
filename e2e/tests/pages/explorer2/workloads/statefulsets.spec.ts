import { test, expect } from '@/support/fixtures';
import { WorkloadsStatefulSetsListPagePo } from '@/e2e/po/pages/explorer/workloads-statefulsets.po';
import {
  createBulkResources,
  setTablePreferences,
  restoreTablePreferences,
  assertPaginationNavigation,
  assertPaginationSorting,
  assertPaginationFilter,
  assertPaginationHidden,
  mockSmallCollection,
  type SavedPrefs,
} from './pagination.utils';
import { SMALL_CONTAINER } from './workload.utils';

test.describe('StatefulSets', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.describe('Redeploy Dialog', () => {
    test('redeploys successfully after confirmation', async ({ page, login, rancherApi }) => {
      await login();
      const namespace = `e2e-sts-ns-${Date.now()}`;
      const statefulSetName = `e2e-sts-${Date.now()}`;

      await rancherApi.createNamespace(namespace);
      await rancherApi.createRancherResource('v1', 'apps.statefulsets', {
        apiVersion: 'apps/v1',
        kind: 'StatefulSet',
        metadata: { name: statefulSetName, namespace },
        spec: {
          replicas: 1,
          serviceName: statefulSetName,
          selector: { matchLabels: { app: statefulSetName } },
          template: {
            metadata: { labels: { app: statefulSetName } },
            spec: { containers: [{ name: 'nginx', image: 'nginx:alpine' }] },
          },
        },
      });

      try {
        const listPage = new WorkloadsStatefulSetsListPagePo(page);

        await listPage.goTo();
        await listPage.waitForPage();

        const actionMenu = await listPage.sortableTable().rowActionMenuOpen(statefulSetName);

        await actionMenu.getMenuItem('Redeploy').click();

        const dialog = listPage.redeployDialog();

        await expect(dialog).toBeVisible();

        const responsePromise = page.waitForResponse(
          (resp) =>
            resp.url().includes(`/v1/apps.statefulsets/${namespace}/${statefulSetName}`) &&
            resp.request().method() === 'PUT',
        );

        await listPage.redeployDialogConfirmButton().click();
        const response = await responsePromise;

        expect(response.status()).toBe(200);
      } finally {
        await rancherApi.deleteRancherResource('v1', 'apps.statefulsets', `${namespace}/${statefulSetName}`, false);
        await rancherApi.deleteRancherResource('v1', 'namespaces', namespace, false);
      }
    });

    test('does not send a request when cancelled', async ({ page, login, rancherApi }) => {
      await login();
      const namespace = `e2e-sts-cancel-ns-${Date.now()}`;
      const statefulSetName = `e2e-sts-cancel-${Date.now()}`;

      await rancherApi.createNamespace(namespace);
      await rancherApi.createRancherResource('v1', 'apps.statefulsets', {
        apiVersion: 'apps/v1',
        kind: 'StatefulSet',
        metadata: { name: statefulSetName, namespace },
        spec: {
          replicas: 1,
          serviceName: statefulSetName,
          selector: { matchLabels: { app: statefulSetName } },
          template: {
            metadata: { labels: { app: statefulSetName } },
            spec: { containers: [{ name: 'nginx', image: 'nginx:alpine' }] },
          },
        },
      });

      let redeployCallCount = 0;

      await page.route(`**/v1/apps.statefulsets/${namespace}/${statefulSetName}`, async (route) => {
        if (route.request().method() === 'PUT') {
          redeployCallCount++;
        }
        await route.continue();
      });

      try {
        const listPage = new WorkloadsStatefulSetsListPagePo(page);

        await listPage.goTo();
        await listPage.waitForPage();

        const actionMenu = await listPage.sortableTable().rowActionMenuOpen(statefulSetName);

        await actionMenu.getMenuItem('Redeploy').click();

        const dialog = listPage.redeployDialog();

        await expect(dialog).toBeVisible();
        await listPage.redeployDialogCancelButton().click();
        await expect(dialog).toBeHidden();
        expect(redeployCallCount).toBe(0);
      } finally {
        await page.unroute(`**/v1/apps.statefulsets/${namespace}/${statefulSetName}`);
        await rancherApi.deleteRancherResource('v1', 'apps.statefulsets', `${namespace}/${statefulSetName}`, false);
        await rancherApi.deleteRancherResource('v1', 'namespaces', namespace, false);
      }
    });

    test('displays error banner on failure', async ({ page, login, rancherApi }) => {
      await login();
      const namespace = `e2e-sts-err-ns-${Date.now()}`;
      const statefulSetName = `e2e-sts-err-${Date.now()}`;

      await rancherApi.createNamespace(namespace);
      await rancherApi.createRancherResource('v1', 'apps.statefulsets', {
        apiVersion: 'apps/v1',
        kind: 'StatefulSet',
        metadata: { name: statefulSetName, namespace },
        spec: {
          replicas: 1,
          serviceName: statefulSetName,
          selector: { matchLabels: { app: statefulSetName } },
          template: {
            metadata: { labels: { app: statefulSetName } },
            spec: { containers: [{ name: 'nginx', image: 'nginx:alpine' }] },
          },
        },
      });

      await page.route(`**/v1/apps.statefulsets/${namespace}/${statefulSetName}`, async (route) => {
        if (route.request().method() === 'PUT') {
          await route.fulfill({ status: 500, body: JSON.stringify({ type: 'error', message: 'simulated failure' }) });
        } else {
          await route.continue();
        }
      });

      try {
        const listPage = new WorkloadsStatefulSetsListPagePo(page);

        await listPage.goTo();
        await listPage.waitForPage();

        const actionMenu = await listPage.sortableTable().rowActionMenuOpen(statefulSetName);

        await actionMenu.getMenuItem('Redeploy').click();

        const dialog = listPage.redeployDialog();

        await expect(dialog).toBeVisible();
        await listPage.redeployDialogConfirmButton().click();
        await expect(listPage.redeployDialogErrorBanner()).toBeVisible();
      } finally {
        await page.unroute(`**/v1/apps.statefulsets/${namespace}/${statefulSetName}`);
        await rancherApi.deleteRancherResource('v1', 'apps.statefulsets', `${namespace}/${statefulSetName}`, false);
        await rancherApi.deleteRancherResource('v1', 'namespaces', namespace, false);
      }
    });
  });

  test.describe('List', { tag: ['@noVai', '@adminUser'] }, () => {
    test.describe.configure({ mode: 'serial' });
    // Serial: tests share bulk resource setup (22 resources + user prefs)

    let savedPrefs: SavedPrefs;
    let ns1: string;
    let ns2: string;
    let bulkNames: string[];
    let uniqueName: string;

    test.beforeAll(async ({ rancherApi }) => {
      ns1 = `e2e-ss-list-${Date.now()}`;
      ns2 = `e2e-ss-unique-${Date.now()}`;

      await Promise.all([
        rancherApi.createRancherResource('v1', 'namespaces', {
          apiVersion: 'v1',
          kind: 'Namespace',
          metadata: { name: ns1 },
        }),
        rancherApi.createRancherResource('v1', 'namespaces', {
          apiVersion: 'v1',
          kind: 'Namespace',
          metadata: { name: ns2 },
        }),
      ]);

      uniqueName = `e2e-unique-${Date.now()}`;

      const [names] = await Promise.all([
        createBulkResources(rancherApi, 'v1', 'apps.statefulsets', ns1, 22, (ns: string, name: string) => ({
          apiVersion: 'apps/v1',
          kind: 'StatefulSet',
          metadata: { name, namespace: ns },
          spec: {
            replicas: 0,
            serviceName: name,
            selector: { matchLabels: { app: name } },
            template: {
              metadata: { labels: { app: name } },
              spec: { containers: [SMALL_CONTAINER] },
            },
          },
        })),
        rancherApi.createRancherResource('v1', 'apps.statefulsets', {
          apiVersion: 'apps/v1',
          kind: 'StatefulSet',
          metadata: { name: uniqueName, namespace: ns2 },
          spec: {
            replicas: 0,
            serviceName: uniqueName,
            selector: { matchLabels: { app: uniqueName } },
            template: {
              metadata: { labels: { app: uniqueName } },
              spec: { containers: [SMALL_CONTAINER] },
            },
          },
        }),
      ]);

      bulkNames = names;
      savedPrefs = await setTablePreferences(rancherApi, [ns1, ns2]);
    });

    test.afterAll(async ({ rancherApi }) => {
      await restoreTablePreferences(rancherApi, savedPrefs);
      await rancherApi.deleteRancherResource('v1', 'namespaces', ns1, false);
      await rancherApi.deleteRancherResource('v1', 'namespaces', ns2, false);
    });

    test('pagination is visible and user is able to navigate through statefulsets data', async ({ page, login }) => {
      await login();
      const listPage = new WorkloadsStatefulSetsListPagePo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      const table = listPage.sortableTable();

      await assertPaginationNavigation(table, 23);
    });

    test('sorting changes the order of paginated statefulsets data', async ({ page, login }) => {
      await login();
      const listPage = new WorkloadsStatefulSetsListPagePo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      const table = listPage.sortableTable();

      await assertPaginationSorting(table, bulkNames[0], 'e2e-');
    });

    test('filter statefulsets', async ({ page, login }) => {
      await login();
      const listPage = new WorkloadsStatefulSetsListPagePo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      const table = listPage.sortableTable();

      await assertPaginationFilter(table, bulkNames[0], uniqueName, ns2);
    });

    test('pagination is hidden', async ({ page, login }) => {
      await login();

      await mockSmallCollection(page, 'v1/apps.statefulsets', 'apps.statefulset');

      const listPage = new WorkloadsStatefulSetsListPagePo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      const table = listPage.sortableTable();

      await assertPaginationHidden(table);

      await page.unroute('**/v1/apps.statefulsets?**');
    });
  });
});
