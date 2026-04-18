import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import ResourceListMastheadPo from '@/e2e/po/components/resource-list-masthead.po';
import CreateEditViewPo from '@/e2e/po/components/create-edit-view.po';
import { WorkloadsDaemonsetsListPagePo } from '@/e2e/po/pages/explorer/workloads-daemonsets.po';

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

      const cruResource = new CreateEditViewPo(page, '.dashboard-root');

      await cruResource.nameNsDescription().name().set(daemonsetName);
      await page.getByTestId('input-container-image-0').fill('nginx');
      await cruResource.formSave().click();

      await listPage.waitForPage();

      const sortableTable = new SortableTablePo(page, '.sortable-table');

      await expect(sortableTable.rowElementWithPartialName(daemonsetName)).toBeVisible();

      const actionMenu = await sortableTable.rowActionMenuOpen(daemonsetName);

      await actionMenu.getMenuItem('Edit Config').click();

      await page.getByTestId('btn-DaemonSet').or(page.locator('#DaemonSet')).click();
      await page.getByTestId('tab-upgrading').or(page.locator('#upgrading')).click();

      const onDeleteRadio = page.locator('.radio-group .radio-container').nth(1);

      await onDeleteRadio.click();

      await cruResource.formSave().click();
    } finally {
      await page.unroute(`**/v1/apps.daemonsets/${namespace}/${daemonsetName}`);
      await rancherApi.deleteRancherResource('v1', 'apps.daemonsets', `${namespace}/${daemonsetName}`, false);
    }
  });

  test.describe('List', { tag: ['@noVai', '@adminUser'] }, () => {
    test.skip(true, 'Pagination tests require bulk resource creation infrastructure (createManyNamespacedResources)');

    test('pagination is visible and user is able to navigate through daemonsets data', async () => {});
    test('sorting changes the order of paginated daemonsets data', async () => {});
    test('filter daemonsets', async () => {});
    test('pagination is hidden', async () => {});
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

        await expect(dialog).toBeVisible();

        const responsePromise = page.waitForResponse(
          (resp) =>
            resp.url().includes(`/v1/apps.daemonsets/${namespace}/${daemonsetName}`) &&
            resp.request().method() === 'PUT',
        );

        await dialog.locator('button').filter({ hasText: 'Redeploy' }).click();
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

        await expect(dialog).toBeVisible();
        await dialog.locator('button').filter({ hasText: 'Cancel' }).click();
        await expect(dialog).toBeHidden();
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

        await expect(dialog).toBeVisible();
        await dialog.locator('button').filter({ hasText: 'Redeploy' }).click();
        await expect(dialog.locator('.banner.error')).toBeVisible();
      } finally {
        await page.unroute(`**/v1/apps.daemonsets/${namespace}/${daemonsetName}`);
        await rancherApi.deleteRancherResource('v1', 'apps.daemonsets', `${namespace}/${daemonsetName}`, false);
      }
    });
  });
});
