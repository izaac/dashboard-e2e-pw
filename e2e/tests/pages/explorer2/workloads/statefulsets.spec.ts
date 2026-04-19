import { test, expect } from '@/support/fixtures';
import { WorkloadsStatefulSetsListPagePo } from '@/e2e/po/pages/explorer/workloads-statefulsets.po';

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
});
