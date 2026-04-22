import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';
import { WorkloadsDeploymentsCreatePagePo } from '@/e2e/po/pages/explorer/workloads/workloads-deployments.po';
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
});
