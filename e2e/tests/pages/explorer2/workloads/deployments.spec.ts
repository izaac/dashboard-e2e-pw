import { test, expect } from '@/support/fixtures';
import {
  WorkloadsDeploymentsListPagePo,
  WorkloadsDeploymentsCreatePagePo,
  WorkloadsDeploymentsDetailsPagePo,
} from '@/e2e/po/pages/explorer/workloads/workloads-deployments.po';
import { SMALL_CONTAINER } from '@/e2e/tests/pages/explorer2/workloads/workload.utils';
import { createDeploymentBlueprint } from '@/e2e/blueprints/explorer/workloads/deployments/deployment-create';
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

        await expect(detailsPage.scalerValue()).toContainText('1', { timeout: 30000 });

        // Wait for PUT response so Vue store gets the new resourceVersion before next scale action
        const scaleUpResp = page.waitForResponse(
          (resp) => resp.url().includes('/v1/apps.deployments/') && resp.request().method() === 'PUT',
        );

        await expect(detailsPage.scaleUpButton()).toBeEnabled();
        await detailsPage.scaleUpButton().click();
        await scaleUpResp;

        await expect(detailsPage.scalerValue()).toContainText('2', { timeout: 30000 });

        // Wait for rollout to fully complete (readyReplicas === replicas) before scaling down
        await rancherApi.waitForRancherResource(
          'v1',
          'apps.deployments',
          `${namespace}/${deploymentName}`,
          (resp) => resp.body.status?.readyReplicas === resp.body.spec?.replicas,
        );
        await detailsPage.waitForScaleComplete();

        const scaleDownResp = page.waitForResponse(
          (resp) => resp.url().includes('/v1/apps.deployments/') && resp.request().method() === 'PUT',
        );

        await detailsPage.scaleDownButton().click();
        const scaleDownResponse = await scaleDownResp;

        expect(scaleDownResponse.status()).toBe(200);

        await expect(detailsPage.scalerValue()).toContainText('1', { timeout: 30000 });
      } finally {
        await rancherApi.deleteRancherResource('v1', 'namespaces', namespace, false);
      }
    });

    test('Should show configuration drawer with the labels/annotations tab open', async ({
      page,
      login,
      rancherApi,
    }) => {
      await login();
      const namespace = `e2e-labels-ns-${Date.now()}`;
      const deploymentName = `e2e-labels-deploy-${Date.now()}`;

      await rancherApi.createNamespace(namespace);
      await rancherApi.createRancherResource('v1', 'apps.deployments', {
        ...createDeploymentBlueprint,
        metadata: { ...createDeploymentBlueprint.metadata, name: deploymentName, namespace },
      });

      try {
        const detailsPage = new WorkloadsDeploymentsDetailsPagePo(page, deploymentName, 'local', namespace);

        await detailsPage.goTo();
        await detailsPage.waitForPage();

        await detailsPage.openEmptyShowConfigurationLabelsLink();
        await expect(detailsPage.labelsAndAnnotationsTab()).toBeVisible();
      } finally {
        await rancherApi.deleteRancherResource('v1', 'apps.deployments', `${namespace}/${deploymentName}`, false);
        await rancherApi.deleteRancherResource('v1', 'namespaces', namespace, false);
      }
    });

    test('Should be able to view and edit configuration of pod volumes with no custom component', async ({
      page,
      login,
      rancherApi,
    }) => {
      await login();
      const namespace = `e2e-vol-ns-${Date.now()}`;
      const deploymentName = `e2e-vol-deploy-${Date.now()}`;

      await rancherApi.createNamespace(namespace);
      await rancherApi.createRancherResource('v1', 'apps.deployments', {
        ...createDeploymentBlueprint,
        metadata: { ...createDeploymentBlueprint.metadata, name: deploymentName, namespace },
      });
      await rancherApi.waitForResourceState('v1', 'apps.deployments', `${namespace}/${deploymentName}`);

      try {
        const deploymentsListPage = new WorkloadsDeploymentsListPagePo(page, 'local');
        const editPage = new WorkloadsDeploymentsCreatePagePo(page, 'local');

        await deploymentsListPage.goTo();
        await deploymentsListPage.waitForPage();
        await deploymentsListPage.goToEditConfigPage(deploymentName);

        await editPage.clickHorizontalTab('pod');
        await editPage.clickPodTab('storage-pod');

        const vol0Value = await editPage.podStorage().nthVolumeComponent(0).yamlEditor().value();

        expect(vol0Value).toContain('name: test-vol');

        const vol1Value = await editPage.podStorage().nthVolumeComponent(1).yamlEditor().value();

        expect(vol1Value).toContain('name: test-vol1');

        await editPage
          .podStorage()
          .nthVolumeComponent(0)
          .yamlEditor()
          .set('name: test-vol-changed\nprojected:\n    defaultMode: 420');

        await editPage.clickHorizontalTab('container-0');
        await editPage.clickContainerTab(0, 'storage');
        await editPage.containerStorage().addVolumeButton().toggle();

        const options = editPage.containerStorage().addVolumeButton().getOptions();

        await expect(options.filter({ hasText: 'test-vol-changed (projected)' })).toBeVisible();
        await expect(options.filter({ hasText: /^test-vol \(projected\)$/ })).not.toBeAttached();

        const saveResponse = page.waitForResponse(
          (resp) =>
            resp.url().includes(`/v1/apps.deployments/${namespace}/${deploymentName}`) &&
            resp.request().method() === 'PUT',
        );

        await editPage.save();
        const response = await saveResponse;

        expect(response.status()).toBe(200);
        const body = await response.json();

        expect(body.spec.template.spec.volumes[0]).toMatchObject({
          name: 'test-vol-changed',
          projected: { defaultMode: 420 },
        });
      } finally {
        await rancherApi.deleteRancherResource('v1', 'apps.deployments', `${namespace}/${deploymentName}`, false);
        await rancherApi.deleteRancherResource('v1', 'namespaces', namespace, false);
      }
    });

    test('should be able to add and remove container volume mounts', async ({ page, login, rancherApi }) => {
      await login();
      const namespace = `e2e-mount-ns-${Date.now()}`;
      const deploymentName = `e2e-mount-deploy-${Date.now()}`;

      await rancherApi.createNamespace(namespace);
      await rancherApi.createRancherResource('v1', 'apps.deployments', {
        ...createDeploymentBlueprint,
        metadata: { ...createDeploymentBlueprint.metadata, name: deploymentName, namespace },
      });
      await rancherApi.waitForResourceState('v1', 'apps.deployments', `${namespace}/${deploymentName}`);

      try {
        const deploymentsListPage = new WorkloadsDeploymentsListPagePo(page, 'local');
        const editPage = new WorkloadsDeploymentsCreatePagePo(page, 'local');

        // Add a volume mount
        await deploymentsListPage.goTo();
        await deploymentsListPage.waitForPage();
        await deploymentsListPage.goToEditConfigPage(deploymentName);

        await editPage.clickContainerTab(0, 'storage');
        await editPage.containerStorage().addVolume('test-vol1');
        await editPage.containerStorage().nthVolumeMount(0).nthMountPoint(0).set('test-123');

        const addResponse = page.waitForResponse(
          (resp) =>
            resp.url().includes(`/v1/apps.deployments/${namespace}/${deploymentName}`) &&
            resp.request().method() === 'PUT',
        );

        await editPage.save();
        const addResp = await addResponse;

        expect(addResp.status()).toBe(200);
        const addBody = await addResp.json();

        expect(addBody.spec.template.spec.containers[0].volumeMounts).toEqual(
          expect.arrayContaining([expect.objectContaining({ mountPath: 'test-123', name: 'test-vol1' })]),
        );

        // Remove the volume mount — wait for resource to stabilize after add
        await rancherApi.waitForResourceState('v1', 'apps.deployments', `${namespace}/${deploymentName}`);
        await deploymentsListPage.goTo();
        await deploymentsListPage.waitForPage();
        await deploymentsListPage.goToEditConfigPage(deploymentName);

        await editPage.clickContainerTab(0, 'storage');
        await editPage.containerStorage().removeVolume(0);

        const removeResponse = page.waitForResponse(
          (resp) =>
            resp.url().includes(`/v1/apps.deployments/${namespace}/${deploymentName}`) &&
            resp.request().method() === 'PUT',
        );

        await editPage.save();
        const removeResp = await removeResponse;

        expect(removeResp.status()).toBe(200);
        const removeBody = await removeResp.json();
        const mounts = removeBody.spec.template.spec.containers[0].volumeMounts;

        expect(mounts ?? []).toHaveLength(0);
      } finally {
        await rancherApi.deleteRancherResource('v1', 'apps.deployments', `${namespace}/${deploymentName}`, false);
        await rancherApi.deleteRancherResource('v1', 'namespaces', namespace, false);
      }
    });

    test('should be able to add and remove EnvVars', async ({ page, login }) => {
      await login();
      const deploymentsCreatePage = new WorkloadsDeploymentsCreatePagePo(page, 'local');

      await deploymentsCreatePage.goTo();
      await deploymentsCreatePage.waitForPage();

      await deploymentsCreatePage.containerTab(0).click();

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
    test.describe.configure({ mode: 'serial' });
    // Serial: tests share bulk resource setup (22 resources + user prefs)

    let savedPrefs: SavedPrefs;
    let ns1: string;
    let ns2: string;
    let bulkNames: string[];
    let uniqueName: string;

    test.beforeAll(async ({ rancherApi }) => {
      ns1 = `e2e-deploy-list-${Date.now()}`;
      ns2 = `e2e-deploy-unique-${Date.now()}`;

      await Promise.all([rancherApi.createNamespace(ns1), rancherApi.createNamespace(ns2)]);

      uniqueName = `e2e-unique-${Date.now()}`;

      const [names] = await Promise.all([
        createBulkResources(rancherApi, 'v1', 'apps.deployments', ns1, 22, (ns: string, name: string) => ({
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: { name, namespace: ns },
          spec: {
            replicas: 0,
            selector: { matchLabels: { app: name } },
            template: {
              metadata: { labels: { app: name } },
              spec: { containers: [SMALL_CONTAINER] },
            },
          },
        })),
        rancherApi.createRancherResource('v1', 'apps.deployments', {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: { name: uniqueName, namespace: ns2 },
          spec: {
            replicas: 0,
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

    test('pagination is visible and user is able to navigate through deployments data', async ({ page, login }) => {
      await login();
      const listPage = new WorkloadsDeploymentsListPagePo(page, 'local');

      await listPage.goTo();
      await listPage.waitForPage();
      const table = listPage.sortableTablePo();

      await assertPaginationNavigation(table, 23);
    });

    test('sorting changes the order of paginated deployments data', async ({ page, login }) => {
      await login();
      const listPage = new WorkloadsDeploymentsListPagePo(page, 'local');

      await listPage.goTo();
      await listPage.waitForPage();
      const table = listPage.sortableTablePo();

      await assertPaginationSorting(table, bulkNames[0], 'e2e-');
    });

    test('filter deployments', async ({ page, login }) => {
      await login();
      const listPage = new WorkloadsDeploymentsListPagePo(page, 'local');

      await listPage.goTo();
      await listPage.waitForPage();
      const table = listPage.sortableTablePo();

      await assertPaginationFilter(table, bulkNames[0], uniqueName, ns2);
    });

    test('pagination is hidden', async ({ page, login }) => {
      await login();

      await mockSmallCollection(page, 'v1/apps.deployments', 'apps.deployment');

      const listPage = new WorkloadsDeploymentsListPagePo(page, 'local');

      await listPage.goTo();
      await listPage.waitForPage();
      const table = listPage.sortableTablePo();

      await assertPaginationHidden(table);

      await page.unroute('**/v1/apps.deployments?**');
    });
  });

  test.describe('Redeploy Dialog', () => {
    test('redeploys successfully after confirmation', async ({ page, login, rancherApi }) => {
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
            spec: { containers: [SMALL_CONTAINER] },
          },
        },
      });

      try {
        const listPage = new WorkloadsDeploymentsListPagePo(page, 'local');

        await listPage.goTo();
        await listPage.waitForPage();

        const sortableTable = listPage.sortableTablePo();
        const actionMenu = await sortableTable.rowActionMenuOpen(deploymentName);

        await actionMenu.getMenuItem('Redeploy').click();

        const redeployDialog = listPage.redeployDialog();

        await expect(redeployDialog.self()).toBeVisible();

        const responsePromise = page.waitForResponse(
          (resp) =>
            resp.url().includes(`/v1/apps.deployments/${namespace}/${deploymentName}`) &&
            resp.request().method() === 'PUT',
        );

        await redeployDialog.confirmRedeploy();

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
            spec: { containers: [SMALL_CONTAINER] },
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

        const sortableTable = listPage.sortableTablePo();
        const actionMenu = await sortableTable.rowActionMenuOpen(deploymentName);

        await actionMenu.getMenuItem('Redeploy').click();

        const redeployDialog = listPage.redeployDialog();

        await expect(redeployDialog.self()).toBeVisible();

        await redeployDialog.cancel();
        await expect(redeployDialog.self()).toBeHidden();

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
            spec: { containers: [SMALL_CONTAINER] },
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

        const sortableTable = listPage.sortableTablePo();
        const actionMenu = await sortableTable.rowActionMenuOpen(deploymentName);

        await actionMenu.getMenuItem('Redeploy').click();

        const redeployDialog = listPage.redeployDialog();

        await expect(redeployDialog.self()).toBeVisible();
        await redeployDialog.confirmRedeploy();

        await expect(redeployDialog.errorBanner()).toBeVisible();
      } finally {
        await page.unroute(`**/v1/apps.deployments/${namespace}/${deploymentName}`);
        await rancherApi.deleteRancherResource('v1', 'apps.deployments', `${namespace}/${deploymentName}`, false);
      }
    });
  });
});
