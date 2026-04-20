import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import ResourceListMastheadPo from '@/e2e/po/components/resource-list-masthead.po';
import CreateEditViewPo from '@/e2e/po/components/create-edit-view.po';
import {
  WorkloadsDaemonsetsListPagePo,
  WorkLoadsDaemonsetsCreatePagePo,
  WorkLoadsDaemonsetsEditPagePo,
} from '@/e2e/po/pages/explorer/workloads-daemonsets.po';
import { SMALL_CONTAINER } from '@/e2e/tests/pages/explorer2/workloads/workload.utils';
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

test.describe('DaemonSets', { tag: ['@explorer2', '@adminUser'] }, () => {
  test('modifying Scaling and Upgrade Policy to On Delete should use correct property OnDelete', async ({
    page,
    login,
    rancherApi,
  }) => {
    await login();
    const daemonsetName = `e2e-ds-${Date.now()}`;
    const namespace = 'default';

    await page.route(`**/v1/apps.daemonsets/${namespace}/${daemonsetName}`, async (route) => {
      if (route.request().method() === 'PUT') {
        const body = JSON.parse(route.request().postData() || '{}');

        expect(body.spec.updateStrategy.type).toBe('OnDelete');
        await route.fulfill({ status: 200, body: JSON.stringify({}) });
      } else {
        await route.continue();
      }
    });

    try {
      const listPage = new PagePo(page, '/c/local/explorer/apps.daemonset');

      await listPage.goTo();
      await listPage.waitForPage();

      const masthead = new ResourceListMastheadPo(page, ':scope');

      await masthead.create();

      const createPage = new WorkLoadsDaemonsetsCreatePagePo(page);
      const cruResource = new CreateEditViewPo(page, '.dashboard-root');

      await cruResource.nameNsDescription().name().set(daemonsetName);
      await createPage.containerImageInput().set('nginx');
      await cruResource.formSave().click();

      await listPage.waitForPage();

      const sortableTable = new SortableTablePo(page, '.sortable-table');

      await expect(sortableTable.rowElementWithPartialName(daemonsetName)).toBeVisible();

      const actionMenu = await sortableTable.rowActionMenuOpen(daemonsetName);

      await actionMenu.getMenuItem('Edit Config').click();

      const editPage = new WorkLoadsDaemonsetsEditPagePo(page, daemonsetName);

      await editPage.daemonSetTab().click();
      await editPage.upgradingTab().click();

      await editPage.scalingUpgradePolicyRadioBtn().getOptionByIndex(1).click();

      await cruResource.formSave().click();
    } finally {
      await page.unroute(`**/v1/apps.daemonsets/${namespace}/${daemonsetName}`);
      await rancherApi.deleteRancherResource('v1', 'apps.daemonsets', `${namespace}/${daemonsetName}`, false);
    }
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
      ns1 = `e2e-ds-list-${Date.now()}`;
      ns2 = `e2e-ds-unique-${Date.now()}`;

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
        createBulkResources(rancherApi, 'v1', 'apps.daemonsets', ns1, 22, (ns: string, name: string) => ({
          apiVersion: 'apps/v1',
          kind: 'DaemonSet',
          metadata: { name, namespace: ns },
          spec: {
            selector: { matchLabels: { app: name } },
            template: {
              metadata: { labels: { app: name } },
              spec: {
                containers: [SMALL_CONTAINER],
                nodeSelector: { 'non-existent-label': 'true' },
              },
            },
          },
        })),
        rancherApi.createRancherResource('v1', 'apps.daemonsets', {
          apiVersion: 'apps/v1',
          kind: 'DaemonSet',
          metadata: { name: uniqueName, namespace: ns2 },
          spec: {
            selector: { matchLabels: { app: uniqueName } },
            template: {
              metadata: { labels: { app: uniqueName } },
              spec: {
                containers: [SMALL_CONTAINER],
                nodeSelector: { 'non-existent-label': 'true' },
              },
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

    test('pagination is visible and user is able to navigate through daemonsets data', async ({ page, login }) => {
      await login();
      const listPage = new PagePo(page, '/c/local/explorer/apps.daemonset');

      await listPage.goTo();
      await listPage.waitForPage();
      const table = new SortableTablePo(page, '.sortable-table');

      await assertPaginationNavigation(table, 23);
    });

    test('sorting changes the order of paginated daemonsets data', async ({ page, login }) => {
      await login();
      const listPage = new PagePo(page, '/c/local/explorer/apps.daemonset');

      await listPage.goTo();
      await listPage.waitForPage();
      const table = new SortableTablePo(page, '.sortable-table');

      await assertPaginationSorting(table, bulkNames[0], 'e2e-');
    });

    test('filter daemonsets', async ({ page, login }) => {
      await login();
      const listPage = new PagePo(page, '/c/local/explorer/apps.daemonset');

      await listPage.goTo();
      await listPage.waitForPage();
      const table = new SortableTablePo(page, '.sortable-table');

      await assertPaginationFilter(table, bulkNames[0], uniqueName, ns2);
    });

    test('pagination is hidden', async ({ page, login }) => {
      await login();

      await mockSmallCollection(page, 'v1/apps.daemonsets', 'apps.daemonset');

      const listPage = new PagePo(page, '/c/local/explorer/apps.daemonset');

      await listPage.goTo();
      await listPage.waitForPage();
      const table = new SortableTablePo(page, '.sortable-table');

      await assertPaginationHidden(table);

      await page.unroute('**/v1/apps.daemonsets?**');
    });
  });

  test.describe('Redeploy dialog', () => {
    test('redeploys successfully after confirmation', async ({ page, login, rancherApi }) => {
      await login();
      const daemonsetName = `e2e-ds-redeploy-${Date.now()}`;
      const namespace = 'default';

      await rancherApi.createRancherResource('v1', 'apps.daemonsets', {
        apiVersion: 'apps/v1',
        kind: 'DaemonSet',
        metadata: { name: daemonsetName, namespace },
        spec: {
          selector: { matchLabels: { app: daemonsetName } },
          template: {
            metadata: { labels: { app: daemonsetName } },
            spec: { containers: [{ name: 'nginx', image: 'nginx:alpine' }] },
          },
        },
      });

      try {
        const listPage = new WorkloadsDaemonsetsListPagePo(page);
        const sortableTable = listPage.baseResourceList().resourceTable().sortableTable();

        await listPage.goTo();
        await listPage.waitForPage();

        const actionMenu = await sortableTable.rowActionMenuOpen(daemonsetName);

        await actionMenu.getMenuItem('Redeploy').click();

        const dialog = listPage.redeployDialog();

        await expect(dialog.self()).toBeVisible();

        const responsePromise = page.waitForResponse(
          (resp) =>
            resp.url().includes(`/v1/apps.daemonsets/${namespace}/${daemonsetName}`) &&
            resp.request().method() === 'PUT',
        );

        await dialog.confirmRedeploy();
        const response = await responsePromise;

        expect(response.status()).toBe(200);
      } finally {
        await rancherApi.deleteRancherResource('v1', 'apps.daemonsets', `${namespace}/${daemonsetName}`, false);
      }
    });

    test('does not send a request when cancelled', async ({ page, login, rancherApi }) => {
      await login();
      const daemonsetName = `e2e-ds-cancel-${Date.now()}`;
      const namespace = 'default';

      await rancherApi.createRancherResource('v1', 'apps.daemonsets', {
        apiVersion: 'apps/v1',
        kind: 'DaemonSet',
        metadata: { name: daemonsetName, namespace },
        spec: {
          selector: { matchLabels: { app: daemonsetName } },
          template: {
            metadata: { labels: { app: daemonsetName } },
            spec: { containers: [{ name: 'nginx', image: 'nginx:alpine' }] },
          },
        },
      });

      let redeployCallCount = 0;

      await page.route(`**/v1/apps.daemonsets/${namespace}/${daemonsetName}`, async (route) => {
        if (route.request().method() === 'PUT') {
          redeployCallCount++;
        }
        await route.continue();
      });

      try {
        const listPage = new WorkloadsDaemonsetsListPagePo(page);
        const sortableTable = listPage.baseResourceList().resourceTable().sortableTable();

        await listPage.goTo();
        await listPage.waitForPage();

        const actionMenu = await sortableTable.rowActionMenuOpen(daemonsetName);

        await actionMenu.getMenuItem('Redeploy').click();

        const dialog = listPage.redeployDialog();

        await expect(dialog.self()).toBeVisible();
        await dialog.cancel();
        await expect(dialog.self()).toBeHidden();
        expect(redeployCallCount).toBe(0);
      } finally {
        await page.unroute(`**/v1/apps.daemonsets/${namespace}/${daemonsetName}`);
        await rancherApi.deleteRancherResource('v1', 'apps.daemonsets', `${namespace}/${daemonsetName}`, false);
      }
    });

    test('displays error banner on failure', async ({ page, login, rancherApi }) => {
      await login();
      const daemonsetName = `e2e-ds-err-${Date.now()}`;
      const namespace = 'default';

      await rancherApi.createRancherResource('v1', 'apps.daemonsets', {
        apiVersion: 'apps/v1',
        kind: 'DaemonSet',
        metadata: { name: daemonsetName, namespace },
        spec: {
          selector: { matchLabels: { app: daemonsetName } },
          template: {
            metadata: { labels: { app: daemonsetName } },
            spec: { containers: [{ name: 'nginx', image: 'nginx:alpine' }] },
          },
        },
      });

      await page.route(`**/v1/apps.daemonsets/${namespace}/${daemonsetName}`, async (route) => {
        if (route.request().method() === 'PUT') {
          await route.fulfill({ status: 500, body: JSON.stringify({ type: 'error', message: 'simulated failure' }) });
        } else {
          await route.continue();
        }
      });

      try {
        const listPage = new WorkloadsDaemonsetsListPagePo(page);
        const sortableTable = listPage.baseResourceList().resourceTable().sortableTable();

        await listPage.goTo();
        await listPage.waitForPage();

        const actionMenu = await sortableTable.rowActionMenuOpen(daemonsetName);

        await actionMenu.getMenuItem('Redeploy').click();

        const dialog = listPage.redeployDialog();

        await expect(dialog.self()).toBeVisible();
        await dialog.confirmRedeploy();
        await expect(dialog.errorBanner()).toBeVisible();
      } finally {
        await page.unroute(`**/v1/apps.daemonsets/${namespace}/${daemonsetName}`);
        await rancherApi.deleteRancherResource('v1', 'apps.daemonsets', `${namespace}/${daemonsetName}`, false);
      }
    });
  });
});
