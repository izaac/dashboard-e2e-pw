import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';
import {
  WorkloadsDeploymentsCreatePagePo,
  WorkloadsDeploymentsListPagePo,
} from '@/e2e/po/pages/explorer/workloads/workloads-deployments.po';
import NodeSchedulingPo from '@/e2e/po/components/workloads/node-scheduling.po';
import { createDeploymentBlueprint } from '@/e2e/blueprints/explorer/workloads/deployments/deployment-create';
import { SMALL_CONTAINER } from '@/e2e/tests/pages/explorer2/workloads/workload.utils';

test.describe('Workloads', { tag: ['@noVai', '@adminUser'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('creating a simple pod should appear on the workloads list page', async ({ page, rancherApi }) => {
    const podName = `e2e-pod-${Date.now()}`;
    const namespace = 'default';

    try {
      await rancherApi.createPod(namespace, podName, SMALL_CONTAINER.image);

      const podDetailPage = new PagePo(page, `/c/local/explorer/pod/${namespace}/${podName}`);

      await podDetailPage.goTo();
      await podDetailPage.waitForPage();

      await expect(podDetailPage.mastheadTitle()).toContainText(podName);
    } finally {
      await rancherApi.deleteRancherResource('v1', `pods/${namespace}`, podName, false);
    }
  });

  test('Validation errors should not be shown when form is just opened', async ({ page }) => {
    const deploymentsCreatePage = new WorkloadsDeploymentsCreatePagePo(page);

    await deploymentsCreatePage.goTo();
    await deploymentsCreatePage.waitForPage();

    await expect(deploymentsCreatePage.errorBanner()).not.toBeAttached();
  });

  // https://github.com/rancher/dashboard/issues/16092
  test.describe('Node Scheduling', () => {
    test('should clear nodeName when switching node scheduling back to any node', async ({ page, rancherApi }) => {
      const namespace = 'default';
      const deploymentId = `e2e-node-sched-${Date.now()}`;

      // Seed a deployment that already pins a node, so the form opens on
      // "Run pods on specific nodes" — the state this regression test exercises.
      const deployment = structuredClone(createDeploymentBlueprint);

      deployment.metadata.name = deploymentId;
      (deployment.spec.template.spec as { nodeName?: string }).nodeName = 'some-node';

      await rancherApi.createRancherResource('v1', 'apps.deployment', deployment);

      try {
        const deploymentsListPage = new WorkloadsDeploymentsListPagePo(page);
        const deploymentEditConfigPage = new WorkloadsDeploymentsCreatePagePo(page);

        await deploymentsListPage.goTo();
        await deploymentsListPage.waitForPage();
        await deploymentsListPage.goToEditConfigPage(deploymentId);

        await deploymentEditConfigPage.clickHorizontalTab('pod');
        await deploymentEditConfigPage.clickPodTab('nodeScheduling-pod');

        const nodeScheduling = new NodeSchedulingPo(page);

        // Precondition: the seeded nodeName selects "Run pods on specific nodes".
        await expect(nodeScheduling.radioOption(1)).toHaveAttribute('aria-checked', 'true');

        await nodeScheduling.selectAnyNode();

        // The node selector disappears once scheduling is back to "any node".
        await expect(nodeScheduling.nodeSelector()).not.toBeAttached();

        // Capture the save PUT to confirm nodeName is dropped from the payload.
        const editDeployment = page.waitForResponse(
          (resp) =>
            resp.request().method() === 'PUT' &&
            resp.url().includes('/apps.deployment') &&
            resp.url().includes(deploymentId),
        );

        await deploymentEditConfigPage.save();

        const response = await editDeployment;

        expect(response.status()).toBe(200);

        const requestBody = response.request().postDataJSON() as {
          spec: { template: { spec: Record<string, unknown> } };
        };

        expect(requestBody.spec.template.spec).not.toHaveProperty('nodeName');
      } finally {
        await rancherApi.deleteRancherResource('v1', 'apps.deployment', `${namespace}/${deploymentId}`, false);
      }
    });
  });
});
