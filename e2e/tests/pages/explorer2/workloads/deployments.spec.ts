import { test, expect } from '@/support/fixtures';
import {
  WorkloadsDeploymentsListPagePo,
  WorkloadsDeploymentsCreatePagePo,
  WorkloadsDeploymentsDetailsPagePo,
} from '@/e2e/po/pages/explorer/workloads/workloads-deployments.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import { SMALL_CONTAINER } from '@/e2e/tests/pages/explorer2/workloads/workload.utils';

test.describe('Deployments', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.describe('CRUD', { tag: ['@standardUser', '@adminUser'] }, () => {
    test('should be able to create a new deployment with basic options', async ({ page, login, rancherApi }) => {
      await login();
      const deploymentName = `e2e-deploy-${Date.now()}`;
      const namespace = 'default';

      const deploymentsCreatePage = new WorkloadsDeploymentsCreatePagePo(page, 'local');

      await deploymentsCreatePage.goTo();
      await deploymentsCreatePage.waitForPage();

      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/v1/apps.deployments') && resp.request().method() === 'POST',
      );

      await deploymentsCreatePage.createWithUI(deploymentName, 'nginx', namespace);

      const response = await responsePromise;

      expect(response.status()).toBe(201);
      const body = await response.json();

      expect(body.metadata.name).toBe(deploymentName);
      expect(body.metadata.namespace).toBe(namespace);

      await rancherApi.deleteRancherResource('v1', 'apps.deployments', `${namespace}/${deploymentName}`, false);
    });

    test('Should be able to scale the number of pods', async ({ page, login, rancherApi }) => {
      test.skip(true, 'scale-count-text/scale-up-button/scale-down-button testids added in 2.15, not present in 2.13');
      test.setTimeout(120000);
      await login();
      const namespace = `e2e-scale-ns-${Date.now()}`;
      const deploymentName = `e2e-scale-deploy-${Date.now()}`;

      await rancherApi.createNamespace(namespace);
      await rancherApi.createRancherResource('v1', 'apps.deployments', {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: deploymentName, namespace },
        spec: {
          replicas: 1,
          selector: { matchLabels: { app: deploymentName } },
          template: {
            metadata: { labels: { app: deploymentName } },
            spec: {
              containers: [{ ...SMALL_CONTAINER, image: 'nginx:alpine' }],
              terminationGracePeriodSeconds: 0,
            },
          },
        },
      });

      await rancherApi.waitForResourceState('v1', 'apps.deployments', `${namespace}/${deploymentName}`);

      try {
        const detailsPage = new WorkloadsDeploymentsDetailsPagePo(page, deploymentName, 'local', namespace);

        await detailsPage.goTo();
        await expect(detailsPage.mastheadTitle()).toContainText(deploymentName);

        await expect(page.locator('[data-testid="scale-count-text"]')).toContainText('1', { timeout: 30000 });

        const scaleUpBtn = page.locator('[data-testid="scale-up-button"]');

        await expect(scaleUpBtn).toBeEnabled();
        await scaleUpBtn.click();

        await expect(page.locator('[data-testid="scale-count-text"]')).toContainText('2', { timeout: 30000 });

        const scaleDownBtn = page.locator('[data-testid="scale-down-button"]');

        await scaleDownBtn.click();
        await expect(page.locator('[data-testid="scale-count-text"]')).toContainText('1', { timeout: 30000 });
      } finally {
        await rancherApi.deleteRancherResource('v1', 'namespaces', namespace, false);
      }
    });

    test('should be able to add and remove EnvVars', async ({ page, login }) => {
      await login();
      const deploymentsCreatePage = new WorkloadsDeploymentsCreatePagePo(page, 'local');

      await deploymentsCreatePage.goTo();
      await deploymentsCreatePage.waitForPage();

      await deploymentsCreatePage.containerTab().click();

      await deploymentsCreatePage.addEnvironmentVariable();
      await deploymentsCreatePage.addEnvironmentVariable();
      await deploymentsCreatePage.addEnvironmentVariable();

      await deploymentsCreatePage.environmentVariableKeyInput(0).fill('a');
      await deploymentsCreatePage.environmentVariableValueInput(0).fill('a');
      await deploymentsCreatePage.environmentVariableKeyInput(1).fill('b');
      await deploymentsCreatePage.environmentVariableValueInput(1).fill('b');
      await deploymentsCreatePage.environmentVariableKeyInput(2).fill('c');
      await deploymentsCreatePage.environmentVariableValueInput(2).fill('c');

      await deploymentsCreatePage.removeEnvironmentVariable(1);

      await expect(deploymentsCreatePage.environmentVariableKeyInput(1)).toHaveValue('c');
    });

    test('should be able to select Pod CSI storage option', async ({ page, login }) => {
      await login();
      const deploymentsCreatePage = new WorkloadsDeploymentsCreatePagePo(page, 'local');

      await deploymentsCreatePage.goTo();
      await deploymentsCreatePage.waitForPage();

      await deploymentsCreatePage.podTab().click();
      await deploymentsCreatePage.storagePodTab().click();
      await deploymentsCreatePage.addVolumeButton().click();
      await expect(deploymentsCreatePage.dropdownMenu()).toContainText('CSI');
    });

    test('Should be able to delete the workload', async ({ page, login, rancherApi }) => {
      await login();
      const deploymentName = `e2e-delete-deploy-${Date.now()}`;
      const namespace = 'default';

      await rancherApi.createRancherResource('v1', 'apps.deployments', {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: deploymentName, namespace },
        spec: {
          replicas: 1,
          selector: { matchLabels: { app: deploymentName } },
          template: {
            metadata: { labels: { app: deploymentName } },
            spec: { containers: [{ ...SMALL_CONTAINER }] },
          },
        },
      });

      const listPage = new WorkloadsDeploymentsListPagePo(page, 'local');

      await listPage.goTo();
      await listPage.waitForPage();

      await expect(listPage.listElementWithName(deploymentName)).toBeVisible();

      const responsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes(`/v1/apps.deployments/${namespace}/${deploymentName}`) &&
          resp.request().method() === 'DELETE',
      );

      await listPage.deleteItemWithUI(deploymentName);

      const response = await responsePromise;

      expect([200, 204]).toContain(response.status());
      await expect(listPage.listElementWithName(deploymentName)).not.toBeAttached({ timeout: 15000 });
    });
  });

  test.describe('List', { tag: ['@noVai', '@adminUser'] }, () => {
    test.skip(true, 'Pagination tests require bulk resource creation infrastructure (createManyNamespacedResources)');

    test('pagination is visible and user is able to navigate through deployments data', async () => {});
    test('sorting changes the order of paginated deployments data', async () => {});
    test('filter deployments', async () => {});
    test('pagination is hidden', async () => {});
  });

  test.describe('Redeploy Dialog', () => {
    test('redeploys successfully after confirmation', async ({ page, login, rancherApi }) => {
      test.skip(true, 'Redeploy dialog (redeploy-dialog testid) is a 2.15 feature, not present in 2.13');
      await login();
      const deploymentName = `e2e-redeploy-${Date.now()}`;
      const namespace = 'default';

      await rancherApi.createRancherResource('v1', 'apps.deployments', {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: deploymentName, namespace },
        spec: {
          replicas: 1,
          selector: { matchLabels: { app: deploymentName } },
          template: {
            metadata: { labels: { app: deploymentName } },
            spec: { containers: [{ name: 'nginx', image: 'nginx:alpine' }] },
          },
        },
      });

      try {
        const listPage = new WorkloadsDeploymentsListPagePo(page, 'local');

        await listPage.goTo();
        await listPage.waitForPage();

        const sortableTable = new SortableTablePo(page, '.sortable-table');
        const actionMenu = await sortableTable.rowActionMenuOpen(deploymentName);

        await actionMenu.getMenuItem('Redeploy').click();

        const redeployDialog = page.getByTestId('redeploy-dialog').or(page.locator('.prompt-modal'));

        await expect(redeployDialog).toBeVisible();

        const responsePromise = page.waitForResponse(
          (resp) =>
            resp.url().includes(`/v1/apps.deployments/${namespace}/${deploymentName}`) &&
            resp.request().method() === 'PUT',
        );

        await redeployDialog.locator('button').filter({ hasText: 'Redeploy' }).click();

        const response = await responsePromise;

        expect(response.status()).toBe(200);
      } finally {
        await rancherApi.deleteRancherResource('v1', 'apps.deployments', `${namespace}/${deploymentName}`, false);
      }
    });

    test('does not send a request when cancelled', async ({ page, login, rancherApi }) => {
      await login();
      const deploymentName = `e2e-redeploy-cancel-${Date.now()}`;
      const namespace = 'default';

      await rancherApi.createRancherResource('v1', 'apps.deployments', {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: deploymentName, namespace },
        spec: {
          replicas: 1,
          selector: { matchLabels: { app: deploymentName } },
          template: {
            metadata: { labels: { app: deploymentName } },
            spec: { containers: [{ name: 'nginx', image: 'nginx:alpine' }] },
          },
        },
      });

      let redeployCallCount = 0;

      await page.route(`**/v1/apps.deployments/${namespace}/${deploymentName}`, async (route) => {
        if (route.request().method() === 'PUT') {
          redeployCallCount++;
        }
        await route.continue();
      });

      try {
        const listPage = new WorkloadsDeploymentsListPagePo(page, 'local');

        await listPage.goTo();
        await listPage.waitForPage();

        const sortableTable = new SortableTablePo(page, '.sortable-table');
        const actionMenu = await sortableTable.rowActionMenuOpen(deploymentName);

        await actionMenu.getMenuItem('Redeploy').click();

        const redeployDialog = page.getByTestId('redeploy-dialog').or(page.locator('.prompt-modal'));

        await expect(redeployDialog).toBeVisible();

        await redeployDialog.locator('button').filter({ hasText: 'Cancel' }).click();
        await expect(redeployDialog).toBeHidden();

        expect(redeployCallCount).toBe(0);
      } finally {
        await page.unroute(`**/v1/apps.deployments/${namespace}/${deploymentName}`);
        await rancherApi.deleteRancherResource('v1', 'apps.deployments', `${namespace}/${deploymentName}`, false);
      }
    });

    test('displays error banner on failure', async ({ page, login, rancherApi }) => {
      await login();
      const deploymentName = `e2e-redeploy-err-${Date.now()}`;
      const namespace = 'default';

      await rancherApi.createRancherResource('v1', 'apps.deployments', {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: deploymentName, namespace },
        spec: {
          replicas: 1,
          selector: { matchLabels: { app: deploymentName } },
          template: {
            metadata: { labels: { app: deploymentName } },
            spec: { containers: [{ name: 'nginx', image: 'nginx:alpine' }] },
          },
        },
      });

      await page.route(`**/v1/apps.deployments/${namespace}/${deploymentName}`, async (route) => {
        if (route.request().method() === 'PUT') {
          await route.fulfill({
            status: 500,
            body: JSON.stringify({ type: 'error', message: 'simulated failure' }),
          });
        } else {
          await route.continue();
        }
      });

      try {
        const listPage = new WorkloadsDeploymentsListPagePo(page, 'local');

        await listPage.goTo();
        await listPage.waitForPage();

        const sortableTable = new SortableTablePo(page, '.sortable-table');
        const actionMenu = await sortableTable.rowActionMenuOpen(deploymentName);

        await actionMenu.getMenuItem('Redeploy').click();

        const redeployDialog = page.getByTestId('redeploy-dialog').or(page.locator('.prompt-modal'));

        await expect(redeployDialog).toBeVisible();
        await redeployDialog.locator('button').filter({ hasText: 'Redeploy' }).click();

        await expect(redeployDialog.locator('.banner.error')).toBeVisible();
      } finally {
        await page.unroute(`**/v1/apps.deployments/${namespace}/${deploymentName}`);
        await rancherApi.deleteRancherResource('v1', 'apps.deployments', `${namespace}/${deploymentName}`, false);
      }
    });
  });
});
